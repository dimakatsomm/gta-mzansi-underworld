import {
  connect as natsConnect,
  StringCodec,
  RetentionPolicy,
  StorageType,
  AckPolicy,
  DeliverPolicy,
  ReplayPolicy,
  nanos,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
  type JsMsg,
  type StreamConfig,
  type ConsumerConfig,
} from 'nats';
import { DomainEvent } from '@gtarp/event-schema';
import type { ZodError } from 'zod';

export class EventValidationError extends Error {
  constructor(public override readonly cause: ZodError) {
    super(`EventValidationError: ${cause.message}`);
    this.name = 'EventValidationError';
  }
}

export interface SubscribeOpts {
  durableName?: string;
  deliverPolicy?: 'all' | 'new' | 'last';
}

/** Opaque handle returned by subscribe — call close() to stop consuming. */
export interface Subscription {
  close(): void;
}

export interface EventBus {
  publish(event: DomainEvent): Promise<{ seq: number }>;
  subscribe(
    subjectPattern: string,
    handler: (evt: DomainEvent, msg: JsMsg) => Promise<void>,
    opts?: SubscribeOpts,
  ): Promise<Subscription>;
  ensureStream(name?: string, subjects?: string[]): Promise<void>;
  close(): Promise<void>;
}

const STREAM_NAME = 'gtarp';
const STREAM_SUBJECTS = ['gtarp.>'];
const sc = StringCodec();

export async function connect(opts?: { servers?: string | string[] }): Promise<EventBus> {
  const nc: NatsConnection = await natsConnect({
    servers: opts?.servers ?? process.env['NATS_URL'] ?? 'nats://localhost:4222',
  });
  const js: JetStreamClient = nc.jetstream();
  const jsm: JetStreamManager = await nc.jetstreamManager();

  await _ensureStream(jsm, STREAM_NAME, STREAM_SUBJECTS);

  const bus: EventBus = {
    async publish(event: DomainEvent): Promise<{ seq: number }> {
      const parsed = DomainEvent.safeParse(event);
      if (!parsed.success) {
        throw new EventValidationError(parsed.error);
      }
      const subject = `gtarp.${parsed.data.type}`;
      const pubAck = await js.publish(subject, sc.encode(JSON.stringify(parsed.data)), {
        msgID: parsed.data.id,
      });
      return { seq: pubAck.seq };
    },

    async subscribe(
      subjectPattern: string,
      handler: (evt: DomainEvent, msg: JsMsg) => Promise<void>,
      subscribeOpts?: SubscribeOpts,
    ): Promise<Subscription> {
      const durableName =
        subscribeOpts?.durableName ?? subjectPattern.replace(/[^a-zA-Z0-9_-]/g, '_');

      const deliverPolicyMap: Record<NonNullable<SubscribeOpts['deliverPolicy']>, DeliverPolicy> = {
        all: DeliverPolicy.All,
        new: DeliverPolicy.New,
        last: DeliverPolicy.Last,
      };
      const deliverPolicy = deliverPolicyMap[subscribeOpts?.deliverPolicy ?? 'all'];

      // Durable pull consumer — no deliver_subject needed (avoids push-consumer issues).
      const consumerConfig: Partial<ConsumerConfig> = {
        durable_name: durableName,
        ack_policy: AckPolicy.Explicit,
        max_deliver: 5,
        ack_wait: nanos(30_000), // 30 s in nanoseconds
        filter_subject: subjectPattern,
        deliver_policy: deliverPolicy,
        replay_policy: ReplayPolicy.Instant,
      };

      try {
        await jsm.consumers.info(STREAM_NAME, durableName);
        await jsm.consumers.update(STREAM_NAME, durableName, consumerConfig);
      } catch {
        await jsm.consumers.add(STREAM_NAME, consumerConfig);
      }

      const consumer = await js.consumers.get(STREAM_NAME, durableName);
      const msgs = await consumer.consume();

      void (async () => {
        for await (const msg of msgs) {
          try {
            const raw: unknown = JSON.parse(sc.decode(msg.data));
            const parsed = DomainEvent.safeParse(raw);
            if (!parsed.success) {
              const dlqSubject = `${msg.subject}.dlq`;
              try {
                await js.publish(dlqSubject, msg.data);
              } catch {
                // best-effort DLQ publish
              }
              msg.ack();
              continue;
            }
            await handler(parsed.data, msg as unknown as JsMsg);
          } catch (err) {
            // Handler error — do not ack, allow redelivery up to maxDeliver
            console.error('[event-bus] handler error', err);
          }
        }
      })();

      return { close: () => msgs.close() };
    },

    async ensureStream(name = STREAM_NAME, subjects = STREAM_SUBJECTS): Promise<void> {
      await _ensureStream(jsm, name, subjects);
    },

    async close(): Promise<void> {
      await nc.drain();
    },
  };

  return bus;
}

async function _ensureStream(
  jsm: JetStreamManager,
  name: string,
  subjects: string[],
): Promise<void> {
  const streamConfig: Partial<StreamConfig> = {
    name,
    subjects,
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
    max_age: nanos(30 * 24 * 60 * 60 * 1_000), // 30 days in nanoseconds
  };
  try {
    await jsm.streams.info(name);
    await jsm.streams.update(name, streamConfig);
  } catch {
    await jsm.streams.add(streamConfig);
  }
}
