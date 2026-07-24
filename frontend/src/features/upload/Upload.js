import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Upload = ({ userId }) => {
    const [file, setFile] = useState(null);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [topics, setTopics] = useState([]);
    
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedTopic, setSelectedTopic] = useState("");
    const [status, setStatus] = useState("");

    const API_BASE = "http://localhost:8000";

    
    useEffect(() => {
        axios.get(`${API_BASE}/curriculum/classes`)
            .then(res => setClasses(res.data))
            .catch(err => console.error("Classes not found", err));
    }, []);

    
    useEffect(() => {
        if (selectedClass) {
            axios.get(`${API_BASE}/curriculum/subjects?class_name=${selectedClass}`)
                .then(res => setSubjects(res.data));
        }
    }, [selectedClass]);

    

    const handleUpload = async () => {
        if (!file || !selectedTopic) {
            alert("Please select file and topic!");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('topic_id', selectedTopic);
        formData.append('user_id', userId || 1); // fallback user id 1

        try {
            setStatus("Uploading...");
            const response = await axios.post(`${API_BASE}/ingest/upload`, formData);
            const jobId = response.data.job_id;
            checkStatus(jobId);
        } catch (error) {
            setStatus("Upload Failed!");
        }
    };

    
    const checkStatus = (jobId) => {
        const interval = setInterval(async () => {
            const res = await axios.get(`${API_BASE}/ingest/status/${jobId}`);
            setStatus(`Processing: ${res.data.job_status}`);
            
            if (res.data.job_status === "SUCCESS") {
                clearInterval(interval);
                setStatus(" File processed successfully!");
            } else if (res.data.job_status === "FAILED") {
                clearInterval(interval);
                setStatus(" Processing failed.");
            }
        }, 3000);
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #ddd' }}>
            <h3>Upload Curriculum PDF</h3>
            
            <select onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
            </select>

            <select onChange={(e) => setSelectedSubject(e.target.value)} disabled={!subjects.length}>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.name}</option>)}
            </select>

            {/* Topic dropdown similarly using selectedSubject logic */}

            <input type="file" onChange={(e) => setFile(e.target.files[0])} accept=".pdf,.txt" />
            
            <button onClick={handleUpload}>Start Ingestion</button>
            
            <p><strong>Status:</strong> {status}</p>
        </div>
    );
};

export default Upload;