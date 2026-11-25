import { BRAND } from "@/lib/brand";
import { LegalShell } from "@/components/legal-shell";

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        Welcome to {BRAND.name}. By creating an account, purchasing prepaid GPU
        compute credits, or deploying GPU containers through our platform, you
        agree to these Terms of Service and our Acceptable Use &amp; Export
        Control Policy.
      </p>

      <h2>1. Service Description</h2>
      <p>
        {BRAND.name} provides on-demand, dedicated Secure-tier NVIDIA GPU
        containers, persistent network storage volumes, and optional S3-backed
        pod backups, metered per second on a strict prepaid credit basis.
      </p>

      <h2>2. Prepaid Credits &amp; Billing</h2>
      <ul>
        <li>
          Payments and global tax compliance are processed by our Merchant of
          Record, <strong>Creem</strong>.
        </li>
        <li>
          Accounts start at $0.00 balance. Launching a pod requires a minimum
          credit buffer equal to 30 minutes of retail runtime.
        </li>
        <li>
          Running pods are metered continuously per second. When your credit
          balance reaches $0.00, active pods are automatically terminated and
          ephemeral local disk data is deleted.
        </li>
        <li>
          Persistent Volumes and S3 Backups incur ongoing storage charges until
          you delete them from the Console.
        </li>
      </ul>

      <h2>3. Acceptable Use &amp; Sanctions Compliance</h2>
      <p>
        You must comply with our Acceptable Use Policy (/aup) and all applicable
        export control and sanctions laws. Cryptocurrency mining, illegal
        workloads, malware/DDoS, non-consensual synthetic media / deepfakes, and
        access from embargoed jurisdictions are strictly prohibited and result
        in immediate account termination without refund.
      </p>

      <h2>4. Data &amp; Security Responsibility</h2>
      <p>
        You are solely responsible for securing your SSH keys, backing up
        critical data, and avoiding storage of sensitive unencrypted secrets on
        non-CVM compute nodes.
      </p>

      <h2>5. Limitation of Liability</h2>
      <p>
        Compute infrastructure is provided on an &quot;as-is&quot; and
        &quot;as-available&quot; basis. To the maximum extent permitted by law,{" "}
        {BRAND.name}&apos;s aggregate liability is limited to the prepaid credit
        amount you paid in the 30 days preceding any claim.
      </p>
    </LegalShell>
  );
}
