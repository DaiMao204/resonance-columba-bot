const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const { buildSync } = require('esbuild');

// Exercise the real entry point, conversion, route calculation and registered
// commands. Only Koishi, HTTP and time are replaced: no QQ messages or network.
const root = path.resolve(__dirname, '..');
const source = buildSync({
  entryPoints: [path.join(root, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['axios', 'koishi'],
  write: false,
  logLevel: 'silent',
}).outputFiles[0].text;
const OFFICIAL_URL = 'https://reso-online-ddos.soli-reso.com/get_server_trade/';
const STEAM_URL = 'https://jp-prd-rzns.gameduchy.com/get_server_trade/';
const INITIAL_TIME = 1789538817407;
const STALE_NOTICE = /过期|滞后|未刷新|未更新|旧数据|旧行情/;
const NO_DATA_NOTICE = /暂无|尚未|加载|获取.*失败|请求.*失败/;

// Representative products and base prices from src/data/data.ts, with both
// directions of 修格里城 <-> 七号自由港 available for the real route calculator.
function snapshot(refreshTime, teaPrice = 688) {
  const price = (base, current = base) => ({
    base_price: base, price: current, trend: 1, ti: refreshTime,
  });
  return {
    refresh_time: refreshTime,
    interval: 600,
    server_trade: {
      红茶: {
        buy: { 修格里城: price(688, teaPrice) },
        sell: { 七号自由港: price(915, 1098) },
      },
      啤酒: {
        buy: { 七号自由港: price(118) },
        sell: { 修格里城: price(133, 160) },
      },
      雪金锦袍: {
        sell: { 七号自由港: price(5965, 6502), 塔图站: price(6287, 6916) },
      },
    },
  };
}

// Steam can send an empty string for an unavailable product. Keep real Japanese
// item/city names here so the test also exercises translation before conversion.
function steamSnapshot(refreshTime, teaPrice = 688) {
  const price = (base, current = base) => ({
    base_price: base, price: current, trend: 1, ti: refreshTime,
  });
  return {
    refresh_time: refreshTime,
    interval: 600,
    server_trade: {
      'No.7 BEER': '',
      紅茶: {
        buy: { シュグリシティ: price(688, teaPrice) },
        sell: { 'フリーポートNo.7': price(915, 1098) },
      },
      ナッツ: {
        buy: { 'フリーポートNo.7': price(210) },
        sell: { シュグリシティ: price(237, 284) },
      },
    },
  };
}

const STEAM_CONFIG = { DataUrl: '', SteamOpen: true, SteamTeamList: ['test-steam-group'] };

function makeHarness(responses = [], overrides = {}) {
  let now = INITIAL_TIME;
  let timerId = 0;
  const timers = new Map();
  const requests = [];
  const notices = [];
  const logs = [];
  const hooks = new Map();
  const commands = new Map();
  const middleware = [];
  const queue = responses.slice();
  const schema = new Proxy(() => schema, { get: () => schema });
  const config = {
    QQID: 'test-bot', DataUrl: OFFICIAL_URL, TimerTime: 1,
    SmallPrice: 1, BigPrice: 2, LowSmallPrice: 1, LowBigPrice: 2,
    ShortTeamList: [], TeamList: ['test-group'], ErrorTeamList: [],
    MaxTeamList: [], ErrorItemList: [], SteamOpen: false,
    SteamTeamList: [], JiaoziMarketOpen: false,
    SpecialCurrencyMarketOpen: {}, ItemSendList: {}, StartUrl: '',
    ...overrides,
  };
  const ctx = {
    config,
    bots: {
      'onebot:test-bot': {
        broadcast: (...args) => notices.push(['broadcast', ...args]),
        sendMessage: (...args) => notices.push(['sendMessage', ...args]),
        deleteMessage: () => assert.fail('Tests must not delete messages'),
      },
    },
    on: (name, callback) => hooks.set(name, callback),
    command: (name) => ({ action: (callback) => commands.set(name, callback) }),
    middleware: (callback) => middleware.push(callback),
  };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const addTimer = (callback, delay, ...args) => {
    const id = ++timerId;
    timers.set(id, { callback, delay, args });
    return id;
  };
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: (name) => {
      if (name === 'koishi') return { Schema: schema, h: (type) => `<${type}/>` };
      if (name === 'axios') return {
        get: async (url, options) => {
          requests.push({ url, options });
          assert.ok([OFFICIAL_URL, ...(config.SteamOpen ? [STEAM_URL] : [])].includes(url));
          assert.ok(queue.length, 'An unexpected HTTP request exhausted the fixture queue');
          let response = queue.shift();
          if (typeof response === 'function') response = await response(now);
          if (response instanceof Error) throw response;
          return { data: response };
        },
      };
      return require(name);
    },
    Date: Clock,
    performance,
    console: Object.fromEntries(['log', 'warn', 'error', 'info'].map((name) => [name, (...args) => logs.push(args)])),
    setTimeout: addTimer,
    clearTimeout: (id) => timers.delete(id),
    setInterval: addTimer,
    clearInterval: (id) => timers.delete(id),
  }, { filename: 'bundled-market-plugin.cjs' });
  const plugin = module.exports;
  plugin.apply(ctx, config);

  const flush = async () => {
    // ready starts its first refresh without returning that promise.
    await new Promise(setImmediate);
    await new Promise(setImmediate);
  };
  const sessionFor = (content, channelId = 'test-query-group') => {
    const messages = [];
    return {
      content, channelId, userId: 'test-user',
      messageId: 'test-message', event: { message: { id: 'test-message' } },
      send: async (message) => messages.push(String(message)),
      messages,
    };
  };
  return {
    plugin, timers, requests, notices, logs, queue, flush,
    get now() { return now; },
    advance: (milliseconds) => { now += milliseconds; },
    async start() { await hooks.get('ready')(); await flush(); },
    async dispose() { await hooks.get('dispose')(); await flush(); },
    async command(name, channelId) {
      const session = sessionFor(name, channelId);
      assert.ok(commands.has(name), `Missing command ${name}`);
      const result = await commands.get(name)({ session });
      return [...session.messages, ...(result === undefined ? [] : [String(result)])].join('\n');
    },
    async message(content, channelId) {
      const session = sessionFor(content, channelId);
      const run = async (index) => index < middleware.length
        ? middleware[index](session, () => run(index + 1)) : undefined;
      const result = await run(0);
      return [...session.messages, ...(result === undefined ? [] : [String(result)])].join('\n');
    },
    async runRefreshTimer(refreshName = 'get_price') {
      const entry = [...timers].find(([, timer]) => timer.callback.name === refreshName);
      assert.ok(entry, 'An HTTP failure or stale snapshot must schedule another refresh');
      const [id, timer] = entry;
      assert.ok(timer.delay > 0 && timer.delay <= 60000, `Unexpected retry delay ${timer.delay}`);
      timers.delete(id);
      now += timer.delay;
      await timer.callback(...timer.args);
      await flush();
    },
  };
}

test('before the first response, current market and item lookup explain that data is unavailable', async () => {
  const harness = makeHarness([() => new Promise(() => {})]);
  await harness.start();
  assert.match(await harness.command('当前行情'), NO_DATA_NOTICE);
  const result = await harness.message('时价红茶');
  assert.match(result, NO_DATA_NOTICE);
  assert.doesNotMatch(result, /未查询到名为/);
});

for (const [server, createSnapshot, config, channelId, refreshName, cacheName] of [
  ['official', snapshot, {}, 'test-query-group', 'get_price', 'responseData'],
  ['Steam', steamSnapshot, STEAM_CONFIG, 'test-steam-group', 'get_price_steam', 'responseDataSteam'],
]) {
  test(`${server} stale notices appear only after one hour while retries and alert suppression remain active`, async () => {
    const refreshTime = Math.floor(INITIAL_TIME / 1000) - 1200;
    const harness = makeHarness([
      createSnapshot(refreshTime),
      createSnapshot(refreshTime),
      (now) => createSnapshot(now / 1000 - 1, 700),
    ], config);
    const queryOutputs = async () => [
      await harness.command('当前行情', channelId),
      await harness.command('详细行情', channelId),
      await harness.message('时价红茶', channelId),
      ...(server === 'official' ? [await harness.message('时价雪金', channelId)] : []),
    ];
    await harness.start();
    assert.equal(harness.plugin[cacheName].红茶.buy.修格里城.price, 688);
    const initialOutputs = await queryOutputs();
    assert.match(initialOutputs[0], /综合利润往返跑商行情/);
    assert.match(initialOutputs[0], /路线/);
    assert.match(initialOutputs[2], /查询到商品红茶/);
    assert.match(initialOutputs[2], /688/);
    if (server === 'official') {
      assert.match(initialOutputs[3], /查询到商品雪金锦袍/);
      assert.match(initialOutputs[3], /塔图站/);
    }
    for (const output of initialOutputs) assert.doesNotMatch(output, STALE_NOTICE);
    assert.equal(harness.notices.length, 0);
    assert.ok([...harness.timers.values()].every((timer) => timer.delay <= 60000),
      'Short-term stale data must not schedule a delayed market notification');

    // Receiving the same snapshot must keep retrying without resetting its age.
    await harness.runRefreshTimer(refreshName);
    assert.equal(harness.requests.length, 2);
    assert.equal(harness.notices.length, 0);
    assert.ok([...harness.timers.values()].some((timer) =>
      timer.callback.name === refreshName && timer.delay > 0 && timer.delay <= 60000));
    for (const output of await queryOutputs()) assert.doesNotMatch(output, STALE_NOTICE);

    for (const age of [3599999, 3600000, 3600001]) {
      harness.advance(refreshTime * 1000 + age - harness.now);
      for (const output of await queryOutputs()) {
        if (age > 3600000) assert.match(output, STALE_NOTICE);
        else assert.doesNotMatch(output, STALE_NOTICE);
      }
      assert.equal(harness.notices.length, 0);
    }

    await harness.plugin[refreshName]();
    assert.equal(harness.requests.length, 3);
    assert.equal(harness.plugin[cacheName].红茶.buy.修格里城.price, 700);
    for (const output of await queryOutputs()) assert.doesNotMatch(output, STALE_NOTICE);
    assert.match(await harness.message('时价红茶', channelId), /700/);
  });
}

test('a failed first request schedules a retry and recovers without a restart', async () => {
  const harness = makeHarness([
    new Error('fixture ECONNRESET'),
    (now) => snapshot(now / 1000 - 1),
  ]);
  await harness.start();
  assert.match(await harness.command('当前行情'), NO_DATA_NOTICE);
  assert.doesNotMatch(await harness.message('时价红茶'), /未查询到名为/);
  await harness.runRefreshTimer();
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.plugin.responseData?.红茶?.buy?.修格里城?.price, 688);
  const market = await harness.command('当前行情');
  assert.match(market, /综合利润往返跑商行情/);
  assert.doesNotMatch(market, STALE_NOTICE);
  const item = await harness.message('时价红茶');
  assert.match(item, /查询到商品红茶/);
  assert.doesNotMatch(item, STALE_NOTICE);
});

test('an older upstream snapshot cannot replace a newer cached price', async () => {
  const firstTime = INITIAL_TIME / 1000 - 1;
  const harness = makeHarness([snapshot(firstTime), snapshot(firstTime - 1200, 123)]);
  await harness.start();
  harness.advance(700000);
  const noticeCount = harness.notices.length;
  await harness.plugin.get_price();
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.plugin.responseData.红茶.buy.修格里城.price, 688);
  assert.equal(harness.plugin.responseData.红茶.buy.修格里城.time, firstTime);
  assert.doesNotMatch(await harness.command('当前行情'), STALE_NOTICE);
  assert.equal(harness.notices.length, noticeCount);
});

test('an invalid response preserves usable cached prices and keeps retrying', async () => {
  const harness = makeHarness([
    snapshot(INITIAL_TIME / 1000 - 1),
    { refresh_time: 'invalid', interval: 600, server_trade: {} },
    (now) => snapshot(now / 1000 - 1, 700),
  ]);
  await harness.start();
  harness.advance(700000);
  await harness.plugin.get_price();
  assert.equal(harness.plugin.responseData.红茶.buy.修格里城.price, 688);
  assert.match(await harness.message('时价红茶'), /查询到商品红茶/);
  await harness.runRefreshTimer();
  assert.equal(harness.plugin.responseData.红茶.buy.修格里城.price, 700);
  assert.doesNotMatch(await harness.command('当前行情'), STALE_NOTICE);
});

test('a calculation failure after accepting valid quotes restores the entire previous market cache', async () => {
  const firstTime = INITIAL_TIME / 1000 - 1;
  const unknownOnly = {
    refresh_time: firstTime + 700,
    interval: 600,
    server_trade: {
      测试未知商品: {
        buy: { 测试未知城市: { price: 100, base_price: 100, trend: 1, ti: firstTime + 700 } },
        sell: { 测试未知城市: { price: 150, base_price: 150, trend: 1, ti: firstTime + 700 } },
      },
    },
  };
  const harness = makeHarness([snapshot(firstTime), unknownOnly]);
  await harness.start();
  const previousCache = harness.plugin.responseData;
  const previousPrices = JSON.stringify(previousCache);
  const previousMarket = (await harness.command('当前行情')).replace(/^<quote\/>/, '');
  const previousDetailed = (await harness.command('详细行情')).replace(/^<quote\/>/, '');
  const previousAvailability = (await harness.command('有行情吗')).replace(/^<quote\/>/, '');
  assert.match(previousMarket, /路线/);
  assert.match(previousAvailability, /有大行情/);
  const noticeCount = harness.notices.length;
  harness.advance(700000);
  await harness.plugin.get_price();
  // The unknown quote passes schema validation; conversion filters it out and
  // leaves the route calculator without a route. This tests rollback after
  // cache assignment, rather than rejection before processing starts.
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.plugin.responseData, previousCache);
  assert.equal(JSON.stringify(harness.plugin.responseData), previousPrices);
  const market = await harness.command('当前行情');
  const detailed = await harness.command('详细行情');
  assert.match(market, /获取失败/);
  assert.ok(market.endsWith(previousMarket), 'The complete previous route output must survive');
  assert.ok(detailed.endsWith(previousDetailed), 'All previous detailed route output must survive');
  assert.ok((await harness.command('有行情吗')).endsWith(previousAvailability),
    'Market availability must remain consistent with the preserved route output');
  assert.match(await harness.message('时价红茶'), /查询到商品红茶/);
  assert.ok(harness.logs.some((args) => String(args[0]).includes('行情获取失败')));
  assert.ok(!harness.logs.some((args) => /无效的|空数据|没有可用报价/.test(args.join(' '))),
    'The fixture must reach calculation rather than fail schema validation');
  assert.equal(harness.notices.length, noticeCount);
  assert.ok([...harness.timers.values()].some((timer) =>
    timer.callback.name === 'get_price' && timer.delay === 60000));
});

test('时价雪金 matches the sell-only crafted item 雪金锦袍', async () => {
  const harness = makeHarness([snapshot(INITIAL_TIME / 1000 - 1)]);
  await harness.start();
  assert.equal(Object.keys(harness.plugin.responseData.雪金锦袍.buy).length, 0);
  const item = await harness.message('时价雪金');
  assert.match(item, /查询到商品雪金锦袍/);
  assert.match(item, /商品出售/);
  assert.match(item, /塔图站/);
  assert.match(item, /6916/);
  assert.doesNotMatch(item, /未查询到名为/);
});

for (const [name, corrupt] of [
  ['empty trade data', (data) => { data.server_trade = {}; }],
  ['malformed quote', (data) => { data.server_trade.红茶.buy.修格里城.price = null; }],
]) {
  test(`${name} cannot clear a previously usable snapshot`, async () => {
    const firstTime = INITIAL_TIME / 1000 - 1;
    const invalid = snapshot(firstTime + 700);
    corrupt(invalid);
    const harness = makeHarness([snapshot(firstTime), invalid]);
    await harness.start();
    harness.advance(700000);
    const noticeCount = harness.notices.length;
    await harness.plugin.get_price();
    assert.equal(harness.plugin.responseData.红茶.buy.修格里城.price, 688);
    assert.equal(harness.plugin.responseData.红茶.buy.修格里城.time, firstTime);
    assert.match(await harness.command('当前行情'), /获取失败/);
    assert.match(await harness.message('时价红茶'), /查询到商品红茶/);
    assert.ok([...harness.timers.values()].some((timer) =>
      timer.callback.name === 'get_price' && timer.delay === 60000));
    assert.equal(harness.notices.length, noticeCount);
  });
}

test('Steam success does not hide an official-server failure', async () => {
  const harness = makeHarness([
    new Error('fixture official server unavailable'),
    snapshot(INITIAL_TIME / 1000 - 1, 700),
  ], { SteamOpen: true, SteamTeamList: ['test-steam-group'] });
  await harness.start();
  assert.deepEqual(harness.requests.map((request) => request.url), [OFFICIAL_URL, STEAM_URL]);
  assert.match(await harness.command('当前行情'), /获取失败/);
  const officialItem = await harness.message('时价红茶');
  assert.match(officialItem, /获取失败/);
  assert.doesNotMatch(officialItem, /未查询到名为|查询到商品红茶/);
  assert.equal(harness.plugin.responseDataSteam.红茶.buy.修格里城.price, 700);
  assert.match(await harness.command('当前行情', 'test-steam-group'), /综合利润往返跑商行情/);
  assert.doesNotMatch(await harness.command('当前行情', 'test-steam-group'), /获取失败|尚未就绪/);
  const steamItem = await harness.message('时价红茶', 'test-steam-group');
  assert.match(steamItem, /查询到商品红茶/);
  assert.match(steamItem, /700/);
  assert.ok([...harness.timers.values()].some((timer) =>
    timer.callback.name === 'get_price' && timer.delay === 60000));
});

test('Steam skips an empty-string product without losing valid quotes or mutating the response', async () => {
  const firstTime = INITIAL_TIME / 1000 - 1;
  const first = steamSnapshot(firstTime);
  const next = steamSnapshot(firstTime + 700, 700);
  const originals = [JSON.stringify(first), JSON.stringify(next)];
  const harness = makeHarness([first, next], STEAM_CONFIG);
  await harness.start();
  assert.deepEqual(harness.requests.map((request) => request.url), [STEAM_URL]);
  assert.equal(harness.plugin.responseDataSteam.红茶.buy.修格里城.price, 688);
  assert.equal(harness.plugin.responseDataSteam.坚果.buy.七号自由港.price, 210);
  assert.ok(!('啤酒' in harness.plugin.responseDataSteam));
  assert.ok(!('No.7 BEER' in harness.plugin.responseDataSteam));
  const market = await harness.command('当前行情', 'test-steam-group');
  assert.match(market, /综合利润往返跑商行情/);
  assert.match(market, /路线/);
  assert.doesNotMatch(market, /获取失败|尚未就绪/);
  assert.match(await harness.message('时价红茶', 'test-steam-group'), /查询到商品红茶/);
  assert.match(await harness.message('时价啤酒', 'test-steam-group'), /未查询到名为/);
  assert.ok(harness.logs.some((args) => args.join(' ').includes('No.7 BEER')),
    'The omitted product should be named in the diagnostic log');

  harness.advance(700000);
  await harness.plugin.get_price_steam();
  assert.equal(harness.plugin.responseDataSteam.红茶.buy.修格里城.price, 700);
  assert.equal(harness.plugin.responseDataSteam.红茶.buy.修格里城.time, firstTime + 700);
  assert.doesNotMatch(await harness.command('当前行情', 'test-steam-group'), /获取失败|尚未就绪/);
  assert.deepEqual([JSON.stringify(first), JSON.stringify(next)], originals);
});

for (const [name, corrupt] of [
  ['only empty-string products', (data) => { data.server_trade = { 'No.7 BEER': '' }; }],
  ['null product', (data) => { data.server_trade.ナッツ = null; }],
  ['nonempty string product', (data) => { data.server_trade.ナッツ = 'unavailable'; }],
  ['array product', (data) => { data.server_trade.ナッツ = []; }],
  ['malformed quote', (data) => { data.server_trade.紅茶.buy.シュグリシティ.price = null; }],
]) {
  test(`Steam ${name} preserves its previous cache and retries in 60 seconds`, async () => {
    const firstTime = INITIAL_TIME / 1000 - 1;
    const invalid = steamSnapshot(firstTime + 700, 700);
    corrupt(invalid);
    const harness = makeHarness([steamSnapshot(firstTime), invalid], STEAM_CONFIG);
    await harness.start();
    const previousCache = harness.plugin.responseDataSteam;
    const previousPrices = JSON.stringify(previousCache);
    const previousMarket = (await harness.command('当前行情', 'test-steam-group')).replace(/^<quote\/>/, '');
    const noticeCount = harness.notices.length;
    harness.advance(700000);
    await harness.plugin.get_price_steam();
    assert.equal(harness.plugin.responseDataSteam, previousCache);
    assert.equal(JSON.stringify(harness.plugin.responseDataSteam), previousPrices);
    const market = await harness.command('当前行情', 'test-steam-group');
    assert.match(market, /获取失败/);
    assert.ok(market.endsWith(previousMarket));
    assert.match(await harness.message('时价红茶', 'test-steam-group'), /查询到商品红茶/);
    assert.ok([...harness.timers.values()].some((timer) =>
      timer.callback.name === 'get_price_steam' && timer.delay === 60000));
    assert.equal(harness.notices.length, noticeCount);
  });
}

test('official snapshots use the same empty-string filter and preserve the response object', async () => {
  const data = snapshot(INITIAL_TIME / 1000 - 1);
  data.server_trade.暂无报价商品 = '';
  const original = JSON.stringify(data);
  const harness = makeHarness([data]);
  await harness.start();
  assert.equal(harness.plugin.responseData.红茶.buy.修格里城.price, 688);
  assert.ok(!('暂无报价商品' in harness.plugin.responseData));
  assert.match(await harness.command('当前行情'), /路线/);
  assert.doesNotMatch(await harness.command('当前行情'), /获取失败|尚未就绪/);
  assert.equal(JSON.stringify(data), original);
});

test('disposing a stale plugin cancels retries and prevents further HTTP requests', async () => {
  const harness = makeHarness([snapshot(INITIAL_TIME / 1000 - 1200)]);
  await harness.start();
  assert.ok(harness.timers.size > 0);
  await harness.dispose();
  assert.equal(harness.timers.size, 0);
  await harness.plugin.get_price();
  assert.equal(harness.requests.length, 1);
});

test('an HTTP response arriving after dispose cannot restart timers or publish data', async () => {
  let resolveRequest;
  const harness = makeHarness([() => new Promise((resolve) => { resolveRequest = resolve; })]);
  await harness.start();
  assert.equal(harness.requests.length, 1);
  await harness.dispose();
  resolveRequest(snapshot(INITIAL_TIME / 1000 - 1));
  await harness.flush();
  assert.equal(harness.timers.size, 0);
  assert.equal(harness.notices.length, 0);
  assert.equal(Object.keys(harness.plugin.responseData ?? {}).length, 0);
});

// Optional replay of an independently downloaded response. The capture stays
// outside the committed fixtures and is never fetched by the test process.
if (process.env.MARKET_SNAPSHOT_FILE) {
  for (const state of ['fresh', 'short-stale', 'long-stale']) {
    test(`captured official response: ${state} snapshot serves current market and 时价雪金`, async (t) => {
      const capture = JSON.parse(fs.readFileSync(process.env.MARKET_SNAPSHOT_FILE, 'utf8'));
      const age = state === 'fresh' ? Math.min(120, capture.interval / 2)
        : state === 'short-stale' ? capture.interval + 300 : Math.max(3601, capture.interval + 300);
      if (state === 'short-stale') assert.ok(age <= 3600, 'The short-stale capture must be within one hour');
      const harness = makeHarness([capture]);
      harness.advance((capture.refresh_time + age) * 1000 - INITIAL_TIME);
      await harness.start();
      const market = await harness.command('当前行情');
      const item = await harness.message('时价雪金');
      assert.match(market, /综合利润往返跑商行情/);
      assert.match(market, /路线/);
      assert.match(item, /查询到商品雪金锦袍/);
      assert.doesNotMatch(item, /未查询到名为/);
      assert.doesNotMatch(market, /尚未就绪|获取失败/);
      assert.ok(!harness.logs.some((args) => String(args[0]).includes('Prestige configurtation not found')));
      if (state === 'long-stale') {
        assert.match(market, STALE_NOTICE);
        assert.match(item, STALE_NOTICE);
      } else {
        assert.doesNotMatch(market, STALE_NOTICE);
        assert.doesNotMatch(item, STALE_NOTICE);
      }
      if (state !== 'fresh') {
        assert.equal(harness.notices.length, 0);
        assert.ok([...harness.timers.values()].every((timer) => timer.delay <= 60000),
          'Stale official quotes must not schedule market alerts');
      }
      t.diagnostic(`Loaded ${Object.keys(harness.plugin.responseData).length} products; ${market}`);
      t.diagnostic(item);
    });
  }
}

if (process.env.MARKET_STEAM_SNAPSHOT_FILE) {
  for (const state of ['fresh', 'short-stale', 'long-stale']) {
    test(`captured Steam response: ${state} snapshot serves current market and 时价红茶`, async (t) => {
      const capture = JSON.parse(fs.readFileSync(process.env.MARKET_STEAM_SNAPSHOT_FILE, 'utf8'));
      const original = JSON.stringify(capture);
      const age = state === 'fresh' ? Math.min(120, capture.interval / 2)
        : state === 'short-stale' ? capture.interval + 300 : Math.max(3601, capture.interval + 300);
      if (state === 'short-stale') assert.ok(age <= 3600, 'The short-stale capture must be within one hour');
      const harness = makeHarness([capture], STEAM_CONFIG);
      harness.advance((capture.refresh_time + age) * 1000 - INITIAL_TIME);
      await harness.start();
      const market = await harness.command('当前行情', 'test-steam-group');
      const item = await harness.message('时价红茶', 'test-steam-group');
      assert.match(market, /综合利润往返跑商行情/);
      assert.match(market, /路线/);
      assert.match(item, /查询到商品红茶/);
      assert.doesNotMatch(market, /尚未就绪|获取失败/);
      assert.doesNotMatch(item, /未查询到名为|获取失败/);
      assert.equal(JSON.stringify(capture), original);
      if (state === 'long-stale') {
        assert.match(market, STALE_NOTICE);
        assert.match(item, STALE_NOTICE);
      } else {
        assert.doesNotMatch(market, STALE_NOTICE);
        assert.doesNotMatch(item, STALE_NOTICE);
      }
      if (state !== 'fresh') {
        assert.equal(harness.notices.length, 0);
        assert.ok([...harness.timers.values()].every((timer) => timer.delay <= 60000),
          'Stale Steam quotes must not schedule market alerts');
      }
      t.diagnostic(`Loaded ${Object.keys(harness.plugin.responseDataSteam).length} Steam products; ${market}`);
      t.diagnostic(item);
    });
  }
}
