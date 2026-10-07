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
