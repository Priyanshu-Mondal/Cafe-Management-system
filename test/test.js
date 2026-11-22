// test/test.js - Automated tests for QuickServe Café API & Business Logic
const assert = require('node:assert');
const { Readable } = require('node:stream');
const { handleApi } = require('../server.js');

function createMockRequest(method, pathname, body = null) {
    let req;
    if (body !== null) {
        const json = JSON.stringify(body);
        req = Readable.from([Buffer.from(json)]);
    } else {
        req = Readable.from([]);
    }
    req.method = method;
    req.url = pathname;
    req.headers = { 'content-type': 'application/json' };
    return req;
}

function createMockResponse() {
    return {
        statusCode: 200,
        headers: {},
        body: '',
        writeHead(status, headers) {
            this.statusCode = status;
            this.headers = headers;
        },
        end(data) {
            this.body = data || '';
        },
        json() {
            return JSON.parse(this.body);
        }
    };
}

async function runTests() {
    console.log('--- Running QuickServe Test Suite ---\n');

    // Test 1: GET /menu
    {
        const req = createMockRequest('GET', '/menu');
        const res = createMockResponse();
        const handled = await handleApi(req, res, '/menu');
        assert.strictEqual(handled, true);
        assert.strictEqual(res.statusCode, 200);
        const menu = res.json();
        assert.strictEqual(Array.isArray(menu), true);
        assert.strictEqual(menu.length >= 20, true, 'Menu should have at least 20 items');
        assert.strictEqual(menu.some(i => i.veg === true), true, 'Menu contains veg items');
        assert.strictEqual(menu.some(i => i.veg === false), true, 'Menu contains non-veg items');
        console.log('✓ Test 1 Passed: GET /menu returns all catalog items with prices & categories');
    }

    // Test 2: GET /tables
    {
        const req = createMockRequest('GET', '/tables');
        const res = createMockResponse();
        const handled = await handleApi(req, res, '/tables');
        assert.strictEqual(handled, true);
        assert.strictEqual(res.statusCode, 200);
        const tables = res.json();
        assert.strictEqual(tables.length, 15, 'Café must have exactly 15 tables');
        assert.strictEqual(tables[0].id, 1);
        assert.strictEqual(tables[14].id, 15);
        console.log('✓ Test 2 Passed: GET /tables returns all 15 café tables');
    }

    // Test 3: POST /orders - Empty order rejection
    {
        const req = createMockRequest('POST', '/orders', {
            tableNo: 1,
            items: []
        });
        const res = createMockResponse();
        await handleApi(req, res, '/orders');
        assert.strictEqual(res.statusCode, 400);
        console.log('✓ Test 3 Passed: Empty order is correctly rejected (400 Bad Request)');
    }

    // Test 4: POST /orders - Invalid table rejection
    {
        const req = createMockRequest('POST', '/orders', {
            tableNo: 99,
            items: [{ id: '1', name: 'Masala Chai', price: 30, qty: 1 }]
        });
        const res = createMockResponse();
        await handleApi(req, res, '/orders');
        assert.strictEqual(res.statusCode, 400);
        console.log('✓ Test 4 Passed: Invalid table number (>15) is rejected (400 Bad Request)');
    }

    // Test 5: POST /orders - Place orders for two different tables
    let order1Id, order2Id;
    {
        // Table 2 order
        const req1 = createMockRequest('POST', '/orders', {
            tableNo: 2,
            items: [
                { id: '1', name: 'Masala Chai', price: 30, qty: 2 },
                { id: '6', name: 'Samosa (2 pcs)', price: 40, qty: 1 }
            ],
            paymentMode: 'cash'
        });
        const res1 = createMockResponse();
        await handleApi(req1, res1, '/orders');
        assert.strictEqual(res1.statusCode, 201);
        const order1 = res1.json();
        order1Id = order1.id;
        assert.strictEqual(order1.tableNo, 2);
        assert.strictEqual(order1.subtotal, 100);
        assert.strictEqual(order1.tax, 5); // 5% GST
        assert.strictEqual(order1.total, 105);
        assert.strictEqual(order1.status, 'pending');

        // Table 8 order
        const req2 = createMockRequest('POST', '/orders', {
            tableNo: 8,
            items: [
                { id: '16', name: 'Chicken Biryani', price: 320, qty: 1 }
            ],
            paymentMode: 'upi'
        });
        const res2 = createMockResponse();
        await handleApi(req2, res2, '/orders');
        assert.strictEqual(res2.statusCode, 201);
        const order2 = res2.json();
        order2Id = order2.id;
        assert.strictEqual(order2.tableNo, 8);
        assert.strictEqual(order2.subtotal, 320);
        assert.strictEqual(order2.total, 336);

        console.log('✓ Test 5 Passed: Successfully placed orders for two different tables (Table 2 & 8) with accurate GST calculation');
    }

    // Test 6: PATCH /orders/:id - Status progression: Pending -> Preparing -> Ready -> Delivered
    {
        // 1. Pending -> Preparing
        const reqPrep = createMockRequest('PATCH', `/orders/${order1Id}`, { status: 'preparing' });
        const resPrep = createMockResponse();
        await handleApi(reqPrep, resPrep, `/orders/${order1Id}`);
        assert.strictEqual(resPrep.statusCode, 200);
        assert.strictEqual(resPrep.json().status, 'preparing');

        // 2. Preparing -> Ready
        const reqReady = createMockRequest('PATCH', `/orders/${order1Id}`, { status: 'ready' });
        const resReady = createMockResponse();
        await handleApi(reqReady, resReady, `/orders/${order1Id}`);
        assert.strictEqual(resReady.statusCode, 200);
        assert.strictEqual(resReady.json().status, 'ready');

        // 3. Ready -> Delivered
        const reqDelivered = createMockRequest('PATCH', `/orders/${order1Id}`, { status: 'delivered' });
        const resDelivered = createMockResponse();
        await handleApi(reqDelivered, resDelivered, `/orders/${order1Id}`);
        assert.strictEqual(resDelivered.statusCode, 200);
        assert.strictEqual(resDelivered.json().status, 'delivered');

        // 4. Invalid status
        const reqInvalid = createMockRequest('PATCH', `/orders/${order1Id}`, { status: 'non-existent' });
        const resInvalid = createMockResponse();
        await handleApi(reqInvalid, resInvalid, `/orders/${order1Id}`);
        assert.strictEqual(resInvalid.statusCode, 400);

        console.log('✓ Test 6 Passed: Full status progression validated: Pending -> Preparing -> Ready -> Delivered');
    }

    console.log('\n========================================');
    console.log('🎉 ALL 6 AUTOMATED TEST SCENARIOS PASSED!');
    console.log('========================================\n');
}

runTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});

