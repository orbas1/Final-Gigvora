'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('connections', ['requester_id', 'addressee_id', 'deleted_at'], {
      name: 'connections_unique_pair',
      unique: true,
    });
    await queryInterface.addIndex('connections', ['requester_id', 'status'], {
      name: 'connections_requester_status_idx',
    });
    await queryInterface.addIndex('connections', ['addressee_id', 'status'], {
      name: 'connections_addressee_status_idx',
    });
    await queryInterface.addIndex('connections', ['created_at'], {
      name: 'connections_created_at_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('connections', 'connections_created_at_idx');
    await queryInterface.removeIndex('connections', 'connections_addressee_status_idx');
    await queryInterface.removeIndex('connections', 'connections_requester_status_idx');
    await queryInterface.removeIndex('connections', 'connections_unique_pair');
  },
};
