$jwtBackend = @"
// JWT Auth Backend
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const users = [{ id: 1, username: 'student1', role: 'STUDENT', password: 'password' },
               { id: 2, username: 'reviewer1', role: 'REVIEWER', password: 'password' }];

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        const token = jwt.sign({ id: user.id, role: user.role }, 'SECRET', { expiresIn: '1h' });
        res.json({ token, user: { username: user.username, role: user.role } });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: 'No token provided' });
    jwt.verify(token, 'SECRET', (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Unauthorized' });
        req.user = decoded;
        next();
    });
};

const checkRole = (roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
};

router.get('/auth/me', verifyToken, (req, res) => {
    res.json(req.user);
});

module.exports = { router, verifyToken, checkRole };
"@
Set-Content -Path "d:\Gehihi\Part1_JWT_Auth\backend\auth.js" -Value $jwtBackend

$jwtFrontend = @"
// JWT Auth Frontend
import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    const login = async (username, password) => {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.token);
            setUser(data.user);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user } = useContext(AuthContext);
    if (!user) return <div>Please login</div>;
    if (allowedRoles && !allowedRoles.includes(user.role)) return <div>Access Denied</div>;
    return children;
};
"@
Set-Content -Path "d:\Gehihi\Part1_JWT_Auth\frontend\AuthContext.jsx" -Value $jwtFrontend

$caseBackend = @"
// Case Submission Backend
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: String,
    description: String,
    status: { type: String, default: 'PENDING' },
    createdAt: { type: Date, default: Date.now }
});

const Case = mongoose.model('Case', caseSchema);

router.post('/cases', async (req, res) => {
    const { title, description } = req.body;
    if (!title || !description) return res.status(400).json({ message: 'Title and description required' });
    
    try {
        const newCase = new Case({ userId: req.user.id, title, description, status: 'SUBMITTED' });
        await newCase.save();
        res.status(201).json({ message: 'Case created successfully', case: newCase });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
"@
Set-Content -Path "d:\Gehihi\Part2_Case_Submission\backend\case.js" -Value $caseBackend

$caseFrontend = @"
// Case Submission Frontend
import React, { useState } from 'react';

export const CaseSubmissionForm = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('/api/cases', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('token')
            },
            body: JSON.stringify({ title, description })
        });
        if (res.ok) setStatus('Gửi thành công!');
        else setStatus('Gửi thất bại!');
    };

    return (
        <form onSubmit={handleSubmit}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả" />
            <button type="submit">Submit Case</button>
            {status && <p>{status}</p>}
        </form>
    );
};
"@
Set-Content -Path "d:\Gehihi\Part2_Case_Submission\frontend\CaseSubmissionForm.jsx" -Value $caseFrontend

$auditBackend = @"
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
"@
Set-Content -Path "d:\Gehihi\Part3_Audit_Trail\backend\auditService.js" -Value $auditBackend

$auditFrontend = @"
// Audit Trail Frontend
import React, { useEffect, useState } from 'react';

export const AuditTimeline = () => {
    const [audits, setAudits] = useState([]);

    useEffect(() => {
        fetch('/api/audits')
            .then(res => res.json())
            .then(data => setAudits(data));
    }, []);

    return (
        <div className="audit-timeline">
            <h2>Audit Timeline</h2>
            <ul>
                {audits.map(audit => (
                    <li key={audit._id}>
                        <strong>{audit.actor}</strong> đã thực hiện <em>{audit.action}</em> lúc {new Date(audit.timestamp).toLocaleString()}
                        <p>Lý do: {audit.reason}</p>
                        <p>Kết quả: {audit.result}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};
"@
Set-Content -Path "d:\Gehihi\Part3_Audit_Trail\frontend\AuditTimeline.jsx" -Value $auditFrontend
