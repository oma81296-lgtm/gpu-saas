import { BRAND } from "@/lib/brand";
import { LegalShell } from "@/components/legal-shell";

export default function AupPage() {
  return (
    <LegalShell title="Acceptable Use & Export Control Policy">
      <p>
        To keep {BRAND.name} reliable, lawful, and compliant with our upstream
        compute network and payment partners, all users must strictly adhere to
        this policy.
      </p>

      <h2>1. Prohibited Workloads</h2>
      <ul>
        <li>
          <strong>Cryptocurrency Mining:</strong> Proof-of-Work mining, mining
          pools (e.g., <code>stratum+tcp</code>), or crypto-jacking workloads
          are strictly prohibited on all pods.
        </li>
        <li>
          <strong>Abusive or Malicious Activity:</strong> Malware distribution,
          ransomware, botnets, DDoS attacks, port scanning, credential stuffing,
          phishing, or spam.
        </li>
        <li>
          <strong>Prohibited Synthetic Media &amp; Content:</strong> Adult/NSFW
          generation services, non-consensual deepfakes, face-swap tools, CSAM,
          or any unlawful content.
        </li>
        <li>
          <strong>Host Interference:</strong> Attempting to escape containers,
          probe host networks, or disrupt other tenants.
        </li>
      </ul>

      <h2>2. Export Control &amp; Sanctions Compliance</h2>
      <p>
        You may not register, purchase credits, deploy pods, or resell{" "}
        {BRAND.name} compute if you are located in, resident in, or acting on
        behalf of:
      </p>
      <ul>
        <li>
          Cuba, Iran, North Korea, Syria, or the Crimea, Donetsk (DNR), or
          Luhansk (LNR) regions of Ukraine, or any other comprehensively
          embargoed jurisdiction.
        </li>
        <li>
          Any individual or entity listed on US (OFAC SDN, Entity List, Denied
          Persons), UK, or EU restricted party lists.
        </li>
      </ul>

      <h2>3. Enforcement</h2>
      <p>
        {BRAND.name} applies automated pre-launch workload screening and
        jurisdiction checks. Violations result in immediate termination of
        running pods and permanent account suspension.
      </p>
    </LegalShell>
  );
}
