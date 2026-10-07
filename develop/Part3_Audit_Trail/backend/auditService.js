// Audit Trail Backend
const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
    action: String,
    timestamp: { type: Date, default: Date.now },
    input: Object,
    result: String,
    reason: String,
    actor: String
});

const Audit = mongoose.model('Audit', auditSchema);

const logAudit = async (action, input, result, reason, actor) => {
    try {
        await new Audit({ action, input, result, reason, actor }).save();
    } catch (err) {
        console.error('Audit log failed', err);
    }
};

module.exports = { Audit, logAudit };
