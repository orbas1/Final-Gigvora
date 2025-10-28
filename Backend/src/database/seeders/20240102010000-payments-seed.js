'use strict';

const { v4: uuid } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const [admins] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = 'admin@gigvora.test' LIMIT 1"
    );
    if (!admins.length) {
      return;
    }
    const adminId = admins[0].id;
    const [wallets] = await queryInterface.sequelize.query('SELECT id FROM wallets WHERE user_id = :userId LIMIT 1', {
      replacements: { userId: adminId },
    });
    let walletId = wallets[0]?.id;
    if (!walletId) {
      walletId = uuid();
      await queryInterface.bulkInsert('wallets', [
        {
          id: walletId,
          user_id: adminId,
          provider: 'internal',
          currency: 'USD',
          available_balance: 0,
          pending_balance: 0,
          metadata: JSON.stringify({ seeded: true }),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }

    const [paymentMethods] = await queryInterface.sequelize.query(
      'SELECT id FROM wallet_payment_methods WHERE wallet_id = :walletId LIMIT 1',
      { replacements: { walletId } }
    );

    if (!paymentMethods.length) {
      await queryInterface.bulkInsert('wallet_payment_methods', [
        {
          id: uuid(),
          wallet_id: walletId,
          type: 'card',
          label: 'Seeded Corporate Card',
          brand: 'VISA',
          last4: '4242',
          exp_month: 12,
          exp_year: new Date().getFullYear() + 3,
          country: 'US',
          is_default: true,
          status: 'active',
          metadata: JSON.stringify({ seeded: true }),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }

    const [payoutAccounts] = await queryInterface.sequelize.query(
      'SELECT id FROM wallet_payout_accounts WHERE wallet_id = :walletId LIMIT 1',
      { replacements: { walletId } }
    );

    if (!payoutAccounts.length) {
      await queryInterface.bulkInsert('wallet_payout_accounts', [
        {
          id: uuid(),
          wallet_id: walletId,
          type: 'bank_account',
          account_holder_name: 'Gigvora Holdings',
          account_identifier_last4: '6789',
          bank_name: 'Gigvora Bank',
          routing_number: '1100000',
          currency: 'USD',
          country: 'US',
          status: 'verified',
          verified_at: new Date(),
          metadata: JSON.stringify({ seeded: true }),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('wallet_payment_methods', { label: 'Seeded Corporate Card' });
    await queryInterface.bulkDelete('wallet_payout_accounts', { account_holder_name: 'Gigvora Holdings' });
    await queryInterface.bulkDelete('wallets', { provider: 'internal', metadata: JSON.stringify({ seeded: true }) });
  },
};
