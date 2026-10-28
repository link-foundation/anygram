import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { DatacenterPool } from '../src/datacenters.js';
const migrate = (type, dc) =>
  Object.assign(new Error(`${type}_MIGRATE_${dc}`), {
    code: 303,
    type: `${type}_MIGRATE_${dc}`,
    migrateTo: dc,
  });
it('keeps phone authentication on the migrated home DC', async () => {
  const calls = [];
  const home = {
    dc: 2,
    rpc: async () => {
      throw migrate('PHONE', 4);
    },
  };
  const target = {
    dc: 4,
    rpc: async (req) => {
      calls.push(req._);
      return 'code';
    },
  };
  const pool = new DatacenterPool(home, () => target);
  assert.equal(await pool.call({ _: 'auth.sendCode' }), 'code');
  assert.equal(pool.home.dc, 4);
  assert.deepEqual(calls, ['auth.sendCode']);
});
it('imports authorization for file DCs without changing the account home DC', async () => {
  const calls = [];
  const home = {
    dc: 2,
    rpc: async (req) => {
      calls.push(req._);
      if (req._ === 'auth.exportAuthorization') {
        return { id: 8n, bytes: new Uint8Array([1]) };
      }
      throw migrate('FILE', 5);
    },
  };
  const target = {
    dc: 5,
    rpc: async (req) => {
      calls.push(req._);
      if (req._ === 'auth.importAuthorization') {
        assert.equal(req.id, 8n);
        return {};
      }
      return 'file';
    },
  };
  const pool = new DatacenterPool(home, () => target);
  assert.equal(await pool.call({ _: 'upload.getFile' }), 'file');
  assert.equal(pool.home.dc, 2);
  assert.deepEqual(calls, [
    'upload.getFile',
    'auth.exportAuthorization',
    'auth.importAuthorization',
    'upload.getFile',
  ]);
});
it('bounds migration cycles and never retries an ambiguous network error', async () => {
  let calls = 0;
  const home = {
    dc: 2,
    rpc: async () => {
      calls++;
      throw new Error('connection lost');
    },
  };
  const pool = new DatacenterPool(home, () => assert.fail());
  await assert.rejects(
    pool.call({ _: 'messages.sendMessage' }),
    /connection lost/
  );
  assert.equal(calls, 1);
  home.rpc = async () => {
    throw migrate('PHONE', 4);
  };
  pool.create = () => ({
    dc: 4,
    rpc: async () => {
      throw migrate('PHONE', 2);
    },
  });
  await assert.rejects(pool.call({ _: 'auth.sendCode' }), /cycle/);
});
it('imports a QR login token on an explicit DC without exporting an unauthorized account', async () => {
  const home = { dc: 2, rpc: () => assert.fail('wrong DC') };
  let saved = false;
  const target = {
    dc: 4,
    rpc: async (req) => {
      assert.equal(req._, 'auth.importLoginToken');
      return 'authorized';
    },
  };
  const pool = new DatacenterPool(
    home,
    () => target,
    () => {
      saved = true;
    }
  );
  assert.equal(
    await pool.call({ _: 'auth.importLoginToken' }, { dc: 4, migrate: true }),
    'authorized'
  );
  assert.equal(pool.home, target);
  assert.equal(saved, true);
  await assert.rejects(
    pool.call({ _: 'auth.importLoginToken' }, { dc: 99 }),
    /data center/
  );
});
