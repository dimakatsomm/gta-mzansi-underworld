# Idempotent label setup for the GitHub repo.
# Usage: pwsh ./scripts/setup-labels.ps1 [-Repo dimakatsomm/gta-mzansi-underworld]

param(
    [string]$Repo = "dimakatsomm/gta-mzansi-underworld"
)

$labels = @(
    @{ name = "copilot-task";    color = "6f42c1"; description = "Sized for one Copilot agent PR" },
    @{ name = "milestone-0";     color = "0e8a16"; description = "M0 Foundation" },
    @{ name = "milestone-1";     color = "1d76db"; description = "M1 Data Model & Event Bus" },
    @{ name = "milestone-2";     color = "1d76db"; description = "M2 AI Orchestrator" },
    @{ name = "milestone-3";     color = "d93f0b"; description = "M3 MVP Vertical Slice (ship gate)" },
    @{ name = "milestone-4";     color = "1d76db"; description = "M4 Factions" },
    @{ name = "milestone-5";     color = "1d76db"; description = "M5 Gang AI & Territory" },
    @{ name = "milestone-6";     color = "1d76db"; description = "M6 Family & Legacy" },
    @{ name = "milestone-7";     color = "1d76db"; description = "M7 Media & Economy" },
    @{ name = "milestone-8";     color = "1d76db"; description = "M8 Story Engine" },
    @{ name = "milestone-9";     color = "1d76db"; description = "M9 Monetization & Hardening" },
    @{ name = "gta-first";       color = "b60205"; description = "Touches core crime/power/money loops" },
    @{ name = "ai-cost-impact";  color = "fbca04"; description = "New AI calls / cost-relevant change" },
    @{ name = "event-schema";    color = "0052cc"; description = "Touches @gtarp/event-schema" },
    @{ name = "lore";            color = "5319e7"; description = "Touches lore bible / SA content" },
    @{ name = "infra";           color = "c5def5"; description = "Docker / k8s / Terraform / CI" },
    @{ name = "security";        color = "ee0701"; description = "Security-sensitive" },
    @{ name = "needs-adr";       color = "f9d0c4"; description = "Decision needs ADR before code" }
)

foreach ($label in $labels) {
    Write-Host "Ensuring label: $($label.name)"
    $null = gh label create $label.name `
        --repo $Repo `
        --color $label.color `
        --description $label.description `
        --force 2>&1
}

Write-Host "Done. $($labels.Count) labels ensured on $Repo."
