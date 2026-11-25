import { BRAND } from "@/lib/brand";
import { LegalShell } from "@/components/legal-shell";

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This Privacy Policy explains how {BRAND.name} collects, uses, and
        protects your information when you use our GPU cloud platform.
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>
          <strong>Account Data:</strong> Name, email address, and authentication
          identifiers (via Appwrite Auth and optional GitHub/Google OAuth).
        </li>
        <li>
          <strong>Operational Data:</strong> Public SSH keys you upload, pod
          launch metadata, usage telemetry, volume/backup records, and credit
          ledger entries.
        </li>
        <li>
          <strong>Compliance &amp; Security Data:</strong> Request IP country
          headers used solely to enforce export control, sanctions, and fraud
          prevention.
        </li>
      </ul>

      <h2>2. Payment Information</h2>
      <p>
        All card and payment details are processed directly by our Merchant of
        Record, <strong>Creem</strong>. {BRAND.name} never collects, touches, or
        stores raw credit card numbers or CVVs on our servers.
      </p>

      <h2>3. Infrastructure Sub-Processors</h2>
      <p>
        When you deploy a GPU pod, {BRAND.name} provisions compute on upstream
        GPU infrastructure using an <strong>opaque customer reference ID</strong>{" "}
        (never your email address or personal name).
      </p>

      <h2>4. Data Retention &amp; Deletion</h2>
      <p>
        You may delete SSH keys, volumes, and backups at any time from the
        Console. Financial ledger records are retained as required for tax and
        accounting compliance.
      </p>
    </LegalShell>
  );
}
