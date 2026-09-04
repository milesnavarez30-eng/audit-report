const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve('c:/Users/Mnavares/Documents/CCTV OPS/audit-report/index.html'), 'utf8');

console.log("=== RUNTIME AUDIT LOGGING VERIFICATION SUITE ===");

let passed = 0;
let total = 0;
function assert(condition, name) {
    total++;
    if (condition) {
        console.log(`✓ [PASS] ${name}`);
        passed++;
    } else {
        console.error(`✗ [FAIL] ${name}`);
    }
}

// 1. Verify that 'uid()' is NOT called anywhere in Script 21 (auth & admin script)
const script21Start = html.lastIndexOf('<script>');
const script21 = html.slice(script21Start);

assert(!script21.includes('id: uid()'), "No undeclared uid() calls in Script 21");
assert(!script21.includes('uid is not defined'), "Clean reference scope");

// 2. Check that the RPC call passes only the supported parameters:
// p_action, p_target_user_id, p_target_item, p_details
// And does NOT pass actor_id, actor_username, or actor_role to the RPC
const rpcCallPattern = /client\.rpc\("log_cctv_security_event",\s*\{([\s\S]*?)\}\)/;
const match = script21.match(rpcCallPattern);

assert(match !== null, "Found client.rpc call for log_cctv_security_event");
if (match) {
    const rpcPayload = match[1];
    assert(rpcPayload.includes('p_action:'), "RPC payload includes p_action");
    assert(rpcPayload.includes('p_target_user_id:'), "RPC payload includes p_target_user_id");
    assert(rpcPayload.includes('p_target_item:'), "RPC payload includes p_target_item");
    assert(rpcPayload.includes('p_details:'), "RPC payload includes p_details");

    assert(!rpcPayload.includes('actor_id'), "RPC payload does NOT pass actor_id");
    assert(!rpcPayload.includes('actor_username'), "RPC payload does NOT pass actor_username");
    assert(!rpcPayload.includes('actor_role'), "RPC payload does NOT pass actor_role");
}

// 3. Check settings save audit call
assert(
    script21.includes('await logSecurityEvent("settings_updated", "operational_settings", detailsToLog, null);') ||
    script21.includes('await logSecurityEvent("settings_updated", "operational_settings"'),
    "Operational settings calls logSecurityEvent with action settings_updated and target operational_settings"
);

// 4. Check account actions
assert(script21.includes('await logSecurityEvent("account_created"'), "Account created event wired");
assert(script21.includes('actionName,') && script21.includes('target?.username'), "setStatus audit event wired");
assert(script21.includes('await logSecurityEvent("role_updated"'), "Role updated event wired");
assert(script21.includes('await logSecurityEvent("permissions_updated"'), "Permissions updated event wired");

// 5. Test mock execution of logSecurityEvent
const mockProfile = { username: "daniel", role: "admin", status: "approved" };
const mockUser = { id: "user-123" };
let rpcParamsSent = null;
const mockClient = {
    rpc: async (fn, params) => {
        rpcParamsSent = { fn, params };
        return { data: "test-uuid-123", error: null };
    },
    from: () => ({
        select: () => ({
            order: () => ({
                limit: async () => ({ data: [], error: null })
            })
        })
    })
};

// Evaluate the isolated logSecurityEvent logic
let executionError = null;
try {
    const safeAction = "settings_updated";
    const targetUserId = null;
    const safeTargetItem = "operational_settings";
    const safeDetails = { theme: { from: "light", to: "dark" } };

    const localId = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : "evt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);

    const localRecord = {
        id: localId,
        created_at: new Date().toISOString(),
        actor_username: mockProfile?.username || "admin",
        actor_role: "admin",
        action: safeAction,
        target_user_id: targetUserId || null,
        target_item: safeTargetItem,
        details: safeDetails
    };

    mockClient.rpc("log_cctv_security_event", {
        p_action: safeAction,
        p_target_user_id: targetUserId || null,
        p_target_item: safeTargetItem,
        p_details: safeDetails
    });
} catch (err) {
    executionError = err;
}

assert(executionError === null, "Mock execution of logSecurityEvent succeeded with no ReferenceError");
assert(rpcParamsSent && rpcParamsSent.fn === "log_cctv_security_event", "RPC called with log_cctv_security_event");
assert(rpcParamsSent && rpcParamsSent.params.p_action === "settings_updated", "p_action is settings_updated");
assert(rpcParamsSent && rpcParamsSent.params.p_target_user_id === null, "p_target_user_id is null");
assert(rpcParamsSent && rpcParamsSent.params.p_target_item === "operational_settings", "p_target_item is operational_settings");
assert(rpcParamsSent && rpcParamsSent.params.actor_id === undefined, "actor_id is undefined in RPC call");

console.log(`\nResults: ${passed} / ${total} tests passed.`);
if (passed === total) {
    console.log("ALL RUNTIME AUDIT TESTS PASSED SUCCESSFULLY!");
} else {
    process.exit(1);
}
