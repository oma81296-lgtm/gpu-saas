import { BRAND } from "@/lib/brand";
import { LegalShell } from "@/components/legal-shell";

export default function RefundsPage() {
  return (
    <LegalShell title="Refund Policy">
      <p>
        {BRAND.name} operates on a transparent, prepaid per-second billing model
        with no recurring subscriptions or hidden commitments.
      </p>

      <h2>1. Unused Prepaid Credit Packs</h2>
      <p>
        If you purchased a prepaid credit pack ($10, $25, $50, or $100) and have
        not used any of the credits from that pack, you may request a full
        refund within <strong>14 days</strong> of purchase.
      </p>

      <h2>2. Partially Used Credits</h2>
      <p>
        Compute seconds, persistent volume storage, and backup storage already
        consumed are non-refundable.
      </p>

      <h2>3. Provider or Hardware Faults</h2>
      <p>
        If a running Secure-tier pod terminates unexpectedly due to a verified
        upstream provider or hardware fault (<code>fault_closed</code>), billing
        stops immediately at the time of interruption and you may request a
        goodwill credit adjustment for affected runtime.
      </p>

      <h2>4. Policy Violations</h2>
      <p>
        Accounts terminated for violating our Acceptable Use Policy (including
        cryptocurrency mining, fraud, or sanctions circumvention) are not
        eligible for refunds.
      </p>

      <h2>5. How to Request a Refund</h2>
      <p>
        Contact support with your Account ID (available in the header profile
        menu) and your Creem order receipt ID. Approved refunds are processed
        back to your original payment method via our Merchant of Record, Creem.
      </p>
    </LegalShell>
  );
}
