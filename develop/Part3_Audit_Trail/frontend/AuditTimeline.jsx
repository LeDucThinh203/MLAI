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
