'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, BOOLEAN, JSONB, JSON, ENUM, DECIMAL, INTEGER } = Sequelize;
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType = dialect === 'postgres' ? JSONB : JSON;
    const uuidType = dialect === 'sqlite' ? STRING : UUID;
    const uuidDefault = Sequelize.UUIDV4;
    const enumType = (values) => (dialect === 'sqlite' ? STRING : ENUM(...values));

    await queryInterface.createTable('wallets', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      user_id: { type: uuidType, allowNull: false, unique: true },
      provider: { type: STRING, allowNull: false, defaultValue: 'internal' },
      provider_account_id: { type: STRING },
      currency: { type: STRING, allowNull: false, defaultValue: 'USD' },
      available_balance: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      pending_balance: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('wallets', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'wallets_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('wallet_payment_methods', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      wallet_id: { type: uuidType, allowNull: false },
      type: { type: enumType(['card', 'bank_account', 'wallet', 'upi', 'other']), allowNull: false },
      label: STRING,
      brand: STRING,
      last4: STRING,
      exp_month: INTEGER,
      exp_year: INTEGER,
      country: STRING,
      fingerprint: { type: STRING },
      is_default: { type: BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: STRING, allowNull: false, defaultValue: 'active' },
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('wallet_payment_methods', {
      type: 'foreign key',
      fields: ['wallet_id'],
      name: 'wallet_payment_methods_wallet_id_fkey',
      references: { table: 'wallets', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('wallet_payout_accounts', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      wallet_id: { type: uuidType, allowNull: false },
      type: { type: enumType(['bank_account', 'mobile_money', 'crypto', 'other']), allowNull: false },
      account_holder_name: { type: STRING, allowNull: false },
      account_identifier_last4: STRING,
      bank_name: STRING,
      routing_number: STRING,
      currency: { type: STRING, allowNull: false },
      country: STRING,
      status: { type: STRING, allowNull: false, defaultValue: 'verified' },
      external_account_id: STRING,
      verified_at: DATE,
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('wallet_payout_accounts', {
      type: 'foreign key',
      fields: ['wallet_id'],
      name: 'wallet_payout_accounts_wallet_id_fkey',
      references: { table: 'wallets', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('escrow_intents', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      reference_type: { type: STRING, allowNull: false },
      reference_id: { type: STRING, allowNull: false },
      payer_wallet_id: { type: uuidType, allowNull: false },
      payee_wallet_id: { type: uuidType, allowNull: false },
      amount: { type: DECIMAL(18, 4), allowNull: false },
      currency: { type: STRING, allowNull: false },
      status: { type: enumType(['authorized', 'held', 'captured', 'cancelled', 'refunded']), allowNull: false, defaultValue: 'authorized' },
      captured_amount: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      refunded_amount: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      fee_amount: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      is_on_hold: { type: BOOLEAN, allowNull: false, defaultValue: false },
      hold_reason: TEXT,
      metadata: { type: jsonType },
      idempotency_key: STRING,
      authorized_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      captured_at: DATE,
      cancelled_at: DATE,
      refunded_at: DATE,
      holded_at: DATE,
      released_at: DATE,
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('escrow_intents', {
      type: 'foreign key',
      fields: ['payer_wallet_id'],
      name: 'escrow_intents_payer_wallet_id_fkey',
      references: { table: 'wallets', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('escrow_intents', {
      type: 'foreign key',
      fields: ['payee_wallet_id'],
      name: 'escrow_intents_payee_wallet_id_fkey',
      references: { table: 'wallets', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('payouts', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      wallet_id: { type: uuidType, allowNull: false },
      payout_account_id: { type: uuidType, allowNull: false },
      amount: { type: DECIMAL(18, 4), allowNull: false },
      currency: { type: STRING, allowNull: false },
      status: { type: enumType(['processing', 'completed', 'failed']), allowNull: false, defaultValue: 'processing' },
      initiated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      processed_at: DATE,
      failure_code: STRING,
      failure_message: TEXT,
      idempotency_key: STRING,
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('payouts', {
      type: 'foreign key',
      fields: ['wallet_id'],
      name: 'payouts_wallet_id_fkey',
      references: { table: 'wallets', field: 'id' },
      onDelete: 'cascade',
    });
    await queryInterface.addConstraint('payouts', {
      type: 'foreign key',
      fields: ['payout_account_id'],
      name: 'payouts_payout_account_id_fkey',
      references: { table: 'wallet_payout_accounts', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('refunds', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      escrow_id: { type: uuidType, allowNull: false },
      amount: { type: DECIMAL(18, 4), allowNull: false },
      currency: { type: STRING, allowNull: false },
      status: { type: enumType(['pending', 'processed', 'failed']), allowNull: false, defaultValue: 'pending' },
      reason: TEXT,
      idempotency_key: STRING,
      processed_at: DATE,
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('refunds', {
      type: 'foreign key',
      fields: ['escrow_id'],
      name: 'refunds_escrow_id_fkey',
      references: { table: 'escrow_intents', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('ledger_entries', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      wallet_id: { type: uuidType, allowNull: false },
      entity_type: STRING,
      entity_id: STRING,
      entry_type: { type: enumType(['debit', 'credit']), allowNull: false },
      category: { type: STRING, allowNull: false },
      amount: { type: DECIMAL(18, 4), allowNull: false },
      currency: { type: STRING, allowNull: false },
      balance_after: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      description: STRING,
      metadata: { type: jsonType },
      occurred_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('ledger_entries', {
      type: 'foreign key',
      fields: ['wallet_id'],
      name: 'ledger_entries_wallet_id_fkey',
      references: { table: 'wallets', field: 'id' },
      onDelete: 'cascade',
    });

    await queryInterface.createTable('invoices', {
      id: { type: uuidType, defaultValue: uuidDefault, primaryKey: true },
      wallet_id: { type: uuidType },
      entity_type: { type: STRING, allowNull: false },
      entity_id: { type: STRING, allowNull: false },
      number: { type: STRING, allowNull: false, unique: true },
      currency: { type: STRING, allowNull: false },
      amount_due: { type: DECIMAL(18, 4), allowNull: false },
      amount_paid: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      status: { type: enumType(['draft', 'open', 'paid', 'void']), allowNull: false, defaultValue: 'open' },
      due_date: DATE,
      issued_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      paid_at: DATE,
      pdf_url: STRING,
      metadata: { type: jsonType },
      deleted_at: DATE,
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('invoices', {
      type: 'foreign key',
      fields: ['wallet_id'],
      name: 'invoices_wallet_id_fkey',
      references: { table: 'wallets', field: 'id' },
      onDelete: 'set null',
    });

    await queryInterface.addIndex('wallet_payment_methods', ['wallet_id']);
    await queryInterface.addIndex('wallet_payment_methods', ['wallet_id', 'is_default']);
    await queryInterface.addIndex('wallet_payout_accounts', ['wallet_id']);
    await queryInterface.addIndex('escrow_intents', ['reference_type', 'reference_id']);
    await queryInterface.addIndex('escrow_intents', ['payer_wallet_id']);
    await queryInterface.addIndex('escrow_intents', ['payee_wallet_id']);
    await queryInterface.addIndex('payouts', ['wallet_id']);
    await queryInterface.addIndex('refunds', ['escrow_id']);
    await queryInterface.addIndex('ledger_entries', ['wallet_id', 'occurred_at']);
    await queryInterface.addIndex('invoices', ['entity_type', 'entity_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('invoices', ['entity_type', 'entity_id']);
    await queryInterface.removeIndex('ledger_entries', ['wallet_id', 'occurred_at']);
    await queryInterface.removeIndex('refunds', ['escrow_id']);
    await queryInterface.removeIndex('payouts', ['wallet_id']);
    await queryInterface.removeIndex('escrow_intents', ['payee_wallet_id']);
    await queryInterface.removeIndex('escrow_intents', ['payer_wallet_id']);
    await queryInterface.removeIndex('escrow_intents', ['reference_type', 'reference_id']);
    await queryInterface.removeIndex('wallet_payout_accounts', ['wallet_id']);
    await queryInterface.removeIndex('wallet_payment_methods', ['wallet_id', 'is_default']);
    await queryInterface.removeIndex('wallet_payment_methods', ['wallet_id']);

    await queryInterface.dropTable('invoices');
    await queryInterface.dropTable('ledger_entries');
    await queryInterface.dropTable('refunds');
    await queryInterface.dropTable('payouts');
    await queryInterface.dropTable('escrow_intents');
    await queryInterface.dropTable('wallet_payout_accounts');
    await queryInterface.dropTable('wallet_payment_methods');
    await queryInterface.dropTable('wallets');
  },
};
