'use strict';

const documents = [
  {
    slug: 'terms',
    title: 'Gigvora Terms of Service',
    version: '2024-01',
    status: 'published',
    summary:
      'These Terms of Service govern access to and use of the Gigvora marketplace, outlining user responsibilities, acceptable use, billing, dispute management, and termination procedures.',
    content: `Welcome to Gigvora. These Terms of Service ("Terms") describe your rights and responsibilities when accessing or using the Gigvora platform. By creating an account or using Gigvora, you agree to be bound by these Terms.

1. Accounts & Eligibility
• You must be at least 18 years old to register. You are responsible for keeping your credentials secure and for all activity on your account.
• You must provide accurate information and promptly update any changes. Gigvora may suspend or terminate accounts that contain false, incomplete, or misleading information.

2. Platform Usage & Acceptable Conduct
• You agree to use Gigvora only for lawful purposes and to comply with all marketplace policies.
• You will not post content that is defamatory, obscene, infringing, or otherwise harmful. Harassment, discrimination, or unauthorized data scraping is prohibited.
• Gigvora may review, moderate, or remove content that violates these Terms.

3. Payments & Fees
• Clients authorize Gigvora to charge payment methods for work performed. Freelancers authorize Gigvora to receive payments on their behalf and remit funds less applicable fees.
• Disputes must be raised within 10 days of delivery. Gigvora may hold funds while disputes are investigated and reserves the right to make a final determination.

4. Intellectual Property
• Unless otherwise agreed in writing, freelancers grant clients a worldwide, royalty-free license to use deliverables once payment is complete.
• You grant Gigvora a limited license to host and display content solely to provide the services.

5. Confidentiality & Data Protection
• Parties must safeguard confidential information obtained through Gigvora and only use it for the intended project.
• Gigvora handles personal data in accordance with the Privacy Policy and applicable law.

6. Termination
• You may close your account at any time. Gigvora may suspend or terminate access for breach of these Terms or to protect the platform or users.
• Upon termination, outstanding obligations (including payment of fees and completion of ongoing projects) remain in force.

7. Changes & Contact
• Gigvora may update these Terms by providing reasonable notice. Continued use after changes take effect constitutes acceptance.
• Questions may be directed to legal@gigvora.com.
`,
  },
  {
    slug: 'privacy',
    title: 'Gigvora Privacy Policy',
    version: '2024-01',
    status: 'published',
    summary:
      'Explains how Gigvora collects, processes, shares, and protects personal data, with details on international transfers, security measures, and user rights.',
    content: `Gigvora respects your privacy. This Privacy Policy describes the personal data we collect, how we use it, and the choices available to you.

1. Data We Collect
• Account data such as name, contact details, profile information, and verification documents.
• Usage data such as device identifiers, log files, and analytics.
• Transaction data such as invoices, payment instruments, and payout preferences.

2. How We Use Data
• To provide and secure the Gigvora platform, process payments, and personalize content.
• To send service communications, marketing (where permitted), and security alerts.
• To comply with legal obligations, enforce agreements, and prevent fraud or abuse.

3. Sharing & Transfers
• We share data with trusted service providers (hosting, payments, support) under strict confidentiality obligations.
• Data may be processed in the United States or other countries where Gigvora or its partners operate, with safeguards such as Standard Contractual Clauses.

4. Your Choices & Rights
• You may update or delete profile information, manage marketing preferences, and access copies of your data.
• Depending on your location, you may have rights to object to processing, request portability, or lodge complaints with regulators.

5. Security & Retention
• We implement technical and organizational safeguards, including encryption in transit, access controls, and continuous monitoring.
• Data is retained for as long as needed to provide services, comply with law, or resolve disputes. When data is no longer needed, it is securely deleted or anonymized.

6. Contact
• Reach the Gigvora Privacy Office at privacy@gigvora.com for questions or to exercise rights.
`,
  },
  {
    slug: 'refunds',
    title: 'Gigvora Refund Policy',
    version: '2024-01',
    status: 'published',
    summary:
      'Details Gigvora\'s approach to cancellations, dispute mediation, qualification for refunds, and timelines for reversing payments.',
    content: `This Refund Policy describes when clients or freelancers may be eligible for refunds or credits on Gigvora.

1. Client-Initiated Refunds
• Clients may request refunds within 10 days of project delivery if the work is incomplete, materially non-compliant with agreed requirements, or not delivered.
• Gigvora reviews refund requests with both parties and may require supporting evidence.

2. Freelancer-Initiated Cancellations
• Freelancers who cannot complete work should cancel the engagement promptly. Funds that have not been released are returned to the client minus payment processing fees.

3. Dispute Resolution
• When parties cannot agree, Gigvora mediation may review communications, deliverables, and escrow transactions. Determinations made by Gigvora are final.

4. Non-Refundable Fees
• Platform fees, dispute fees, and third-party payment charges are generally non-refundable unless required by law.

5. Timelines
• Approved refunds are processed within 5-10 business days. The exact timeframe depends on the client\'s payment provider.

6. Abuse Prevention
• Gigvora may deny refunds for abusive or fraudulent behavior and can suspend accounts to protect the marketplace.
`,
  },
  {
    slug: 'guidelines',
    title: 'Gigvora Community Guidelines',
    version: '2024-01',
    status: 'published',
    summary:
      'Sets expectations for respectful collaboration, prohibited content, safety practices, and enforcement actions across the Gigvora community.',
    content: `These Community Guidelines outline behaviors that keep Gigvora safe, inclusive, and productive.

1. Respect & Professionalism
• Treat all members of the community with professionalism and respect. Discrimination, hate speech, harassment, or threats are prohibited.

2. Quality & Transparency
• Provide accurate information about skills, experience, pricing, and availability. Deliver work that meets agreed quality standards and communicate delays promptly.

3. Safety & Security
• Use Gigvora messaging and file-sharing tools to keep records. Do not request or share credentials insecurely. Report suspicious behavior to support immediately.

4. Prohibited Content
• The following are not allowed: illegal services, explicit content involving minors, malware distribution, or activities that violate intellectual property rights.

5. Enforcement
• Gigvora may issue warnings, suspend accounts, or remove content that violates these guidelines. Repeated or severe violations can result in permanent removal.

6. Reporting
• Use the in-product reporting tools or contact trust@gigvora.com to report violations. Provide context and evidence when possible.
`,
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = documents.map((doc) => ({
      id: require('uuid').v4(),
      slug: doc.slug,
      title: doc.title,
      summary: doc.summary,
      content: doc.content,
      version: doc.version,
      status: doc.status,
      effective_at: now,
      published_at: now,
      metadata: null,
      created_at: now,
      updated_at: now,
    }));

    for (const row of rows) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM legal_documents WHERE slug = :slug AND version = :version',
        { replacements: { slug: row.slug, version: row.version } }
      );
      if (!existing.length) {
        await queryInterface.bulkInsert('legal_documents', [row]);
      }
    }
  },

  async down(queryInterface) {
    const versions = documents.map((doc) => doc.version);
    await queryInterface.bulkDelete('legal_documents', { version: versions });
  },
};
