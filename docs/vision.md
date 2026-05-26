# Vision — AI-Powered South African Mzansi Underworld Server

> Master vision. Source for ADRs, lore, and Phase 1 plan.

## Project name (TBD)

Candidates: Mzansi Underworld RP, Sovereign RP, Jozi State RP, Nine Province RP.

## Core product vision

An AI-powered South African-inspired Mzansi Underworld ecosystem where:

- Crime is the center of the world.
- Police, business, politics react dynamically.
- NPCs feel alive.
- The city remembers player actions.
- Families, dynasties, reputations persist.
- AI creates emergent storytelling and immersion.

**Not:** a meme server, ERP server, generic American RP clone, chatbot simulator.

**Is:** persistent criminal society simulator, AI-driven emergent storytelling platform, SA-inspired living city, future middleware platform for AI RP infrastructure.

## Design principles

1. **GTA first** — every feature deepens crime / power / money / reputation / chaos / freedom / survival.
2. **SA authenticity** — Tsotsi / Gomora / Yizo Yizo / The Queen / Blood & Water tone. No stereotypes.
3. **AI enhances RP, never replaces it.**
4. **Persistence matters** — the city has history.

## Player factions

- **Crime** — street hustler → kingpin progression. Hijack, robbery, drugs, CIT, fraud, protection, smuggling, laundering, corruption.
- **Police / Government** — grounded realism. Investigations, evidence, warrants, IA, corruption temptation, media pressure.
- **Business** — status, influence, laundering fronts. Shisa nyamas, taverns, taxi assocs, security firms, dealerships, logistics, construction, clubs, tech.

## Family / legacy

Households, dynasties, inheritance, public scandals, custody — emotional permanence without ERP.

## AI systems

- AI Dispatch — believable emergency response, dynamic incident text + voice.
- AI Witnesses — NPCs observe, remember, contradict, become informants. Quality modified by lighting/distance/fear/intoxication/relationship.
- AI Gangs — recruit, retaliate, ally, betray.
- AI Media — radio, news, podcasts, gossip.
- AI Economy — supply/demand, insurance, area property value.
- AI Story Engine — gang wars, revenge arcs, scandals, missing persons.

## Technical architecture (locked in M0)

- **Game**: FiveM + QBox.
- **Backend**: Node 20, TypeScript, Fastify.
- **DB**: Postgres 16 + Prisma.
- **Cache / queue**: Redis + BullMQ.
- **Event bus**: NATS JetStream.
- **AI**: OpenAI + Anthropic + ElevenLabs behind `@gtarp/ai-clients`, tiered.
- **Web**: Next.js 15.
- **Discord**: discord.js v14.
- **Infra**: Docker Compose (dev) → Azure AKS (M9+).

## MVP (Milestone 3)

- AI Dispatch + AI Witnesses.
- Dynamic police calls.
- Discord integration.
- Basic gang systems.
- Goal: 10 shareable TikTok clips from internal playtest before unlocking Milestone 4.

## Content strategy

TikTok, YouTube Shorts, Twitch, Discord. AI moments. Gang negotiations. Investigations. Betrayals.

## Monetization

VIP subs (Stripe), founder packages, in-game business ownership. No P2W. See ADR-0005.

## Long-term phases

- Phase 1 — AI-powered SA RP server (this plan).
- Phase 2 — recognized Mzansi Underworld ecosystem; local AI inference.
- Phase 3 — AI middleware platform for RP worlds.
- Phase 4 — cross-game AI social simulation engine.

## Success metrics

- Early: clips generated, Discord activity, retention.
- Mid: VIP MRR, streamer adoption, RP quality.
- Long: middleware licensing, multi-server ecosystem.

## Risks

1. AI cost explosion — mitigated by ADR-0004.
2. Community failure — mitigated by content strategy + moderation discipline.
3. Overbuilding — mitigated by milestone gates (each must produce clip-worthy moments).

## Final principle

Not "another GTA server." First truly living AI-powered criminal society simulator.
