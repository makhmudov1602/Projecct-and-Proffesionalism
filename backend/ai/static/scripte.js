const API_BASE = '/ai';
let frameWs = null;
let detectionWs = null;
let currentCameraId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize settings
    fetchSettings();
    setupEventListeners();
    connectWebSockets();
});

function setupEventListeners() {
    // Start Camera
    document.getElementById('start-camera').addEventListener('click', async () => {
        const cameraId = document.getElementById('camera-id').value;
        const rtspUrl = document.getElementById('rtsp-url').value;
        if (!cameraId || !rtspUrl) {
            alert('Please provide Camera ID and RTSP URL');
            return;
        }
        currentCameraId = parseInt(cameraId);
        try {
            const response = await fetch(`${API_BASE}/cameras/${cameraId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rtsp_url: rtspUrl })
            });
            if (response.ok) {
                alert('Camera stream started');
                updateStreamDisplay();
                fetchDetections();
            } else {
                alert('Failed to start camera stream');
            }
        } catch (error) {
            console.error('Error starting camera:', error);
            alert('Error starting camera stream');
        }
    });

    // Stop Camera
    document.getElementById('stop-camera').addEventListener('click', async () => {
        const cameraId = document.getElementById('camera-id').value;
        if (!cameraId) {
            alert('Please provide Camera ID');
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/cameras/${cameraId}/stop`, {
                method: 'POST'
            });
            if (response.ok) {
                alert('Camera stream stopped');
                currentCameraId = null;
                clearStreamDisplay();
                clearDetections();
            } else {
                alert('Failed to stop camera stream');
            }
        } catch (error) {
            console.error('Error stopping camera:', error);
            alert('Error stopping camera stream');
        }
    });

    // Stream Type Change
    document.getElementById('stream-kind').addEventListener('change', updateStreamDisplay);

    // WebSocket Toggle
    document.getElementById('use-websocket').addEventListener('change', updateStreamDisplay);

    // Settings Form
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const settings = {
            fps: parseInt(document.getElementById('fps').value) || undefined,
            width: parseInt(document.getElementById('width').value) || undefined,
            height: parseInt(document.getElementById('height').value) || undefined,
            format: document.getElementById('format').value || undefined,
            quality: parseInt(document.getElementById('quality').value) || undefined,
            stream_kind: document.getElementById('stream-kind').value || undefined,
            emit_frames: document.getElementById('use-websocket').checked
        };
        try {
            const response = await fetch(`${API_BASE}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (response.ok) {
                alert('Settings updated');
                if (frameWs) {
                    frameWs.send(JSON.stringify({ action: 'settings', settings }));
                }
            } else {
                alert('Failed to update settings');
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            alert('Error updating settings');
        }
    });
}

async function fetchSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        const settings = await response.json();
        document.getElementById('fps').value = settings.fps || '';
        document.getElementById('width').value = settings.width || '';
        document.getElementById('height').value = settings.height || '';
        document.getElementById('format').value = settings.format || 'jpeg';
        document.getElementById('stream-kind').value = settings.stream_kind || 'crop';
        document.getElementById('quality').value = settings.quality || '';
        document.getElementById('use-websocket').checked = settings.emit_frames !== false;
    } catch (error) {
        console.error('Error fetching settings:', error);
    }
}

function connectWebSockets() {
    // Frame WebSocket
    frameWs = new WebSocket(`ws://${window.location.host}${API_BASE}/ws/frames`);
    frameWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.action === 'frame' && data.camera_id === currentCameraId) {
            updateFrames(data);
        } else if (data.action === 'settings_updated') {
            fetchSettings();
        }
    };
    frameWs.onclose = () => {
        setTimeout(connectWebSockets, 5000);
    };

    // Detection WebSocket
    detectionWs = new WebSocket(`ws://${window.location.host}${API_BASE}/ws/detections`);
    detectionWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.action === 'new_detections' && data.camera_id === currentCameraId) {
            updateDetections(data);
        }
    };
    detectionWs.onclose = () => {
        setTimeout(connectWebSockets, 5000);
    };
}

function updateFrames(data) {
    if (!document.getElementById('use-websocket').checked) return;
    const cropImg = document.getElementById('crop-frame');
    const annotatedImg = document.getElementById('annotated-frame');
    const streamKind = document.getElementById('stream-kind').value;

    if (streamKind === 'crop' || streamKind === 'both') {
        if (data.crop && data.crop_mime) {
            cropImg.src = `data:${data.crop_mime};base64,${data.crop}`;
            document.getElementById('crop-frame-container').classList.remove('hidden');
        }
    } else {
        document.getElementById('crop-frame-container').classList.add('hidden');
    }

    if (streamKind === 'annotated' || streamKind === 'both') {
        if (data.annotated && data.annotated_mime) {
            annotatedImg.src = `data:${data.annotated_mime};base64,${data.annotated}`;
            document.getElementById('annotated-frame-container').classList.remove('hidden');
        }
    } else {
        document.getElementById('annotated-frame-container').classList.add('hidden');
    }

    document.getElementById('total-count').textContent = data.total_count || 0;
    document.getElementById('total-score').textContent = data.total_score || 0;
}

async function fetchFrame() {
    if (!currentCameraId || document.getElementById('use-websocket').checked) return;
    const streamKind = document.getElementById('stream-kind').value;
    const cropImg = document.getElementById('crop-frame');
    const annotatedImg = document.getElementById('annotated-frame');

    if (streamKind === 'crop' || streamKind === 'both') {
        try {
            const response = await fetch(`${API_BASE}/cameras/${currentCameraId}/frame?kind=crop`);
            if (response.ok) {
                const blob = await response.blob();
                cropImg.src = URL.createObjectURL(blob);
                document.getElementById('crop-frame-container').classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error fetching crop frame:', error);
        }
    } else {
        document.getElementById('crop-frame-container').classList.add('hidden');
    }

    if (streamKind === 'annotated' || streamKind === 'both') {
        try {
            const response = await fetch(`${API_BASE}/cameras/${currentCameraId}/frame?kind=annotated`);
            if (response.ok) {
                const blob = await response.blob();
                annotatedImg.src = URL.createObjectURL(blob);
                document.getElementById('annotated-frame-container').classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error fetching annotated frame:', error);
        }
    } else {
        document.getElementById('annotated-frame-container').classList.add('hidden');
    }

    setTimeout(fetchFrame, 1000 / (parseInt(document.getElementById('fps').value) || 5));
}

async function fetchDetections() {
    if (!currentCameraId) return;
    try {
        const response = await fetch(`${API_BASE}/cameras/${currentCameraId}/detections`);
        if (response.ok) {
            const data = await response.json();
            updateDetections(data);
        }
    } catch (error) {
        console.error('Error fetching detections:', error);
    }
}

function updateDetections(data) {
    document.getElementById('total-count').textContent = data.total_count || 0;
    document.getElementById('total-score').textContent = data.total_score || 0;

    const tableBody = document.getElementById('detection-table');
    tableBody.innerHTML = '';
    (data.points || []).forEach(point => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${point.x || '-'}</td>
            <td>${point.y || '-'}</td>
            <td>${point.x_rel ? point.x_rel.toFixed(4) : '-'}</td>
            <td>${point.y_rel ? point.y_rel.toFixed(4) : '-'}</td>
            <td>${point.score || '-'}</td>
            <td>${point.conf ? point.conf.toFixed(4) : '-'}</td>
        `;
        tableBody.appendChild(row);
    });
}

function updateStreamDisplay() {
    const useWebSocket = document.getElementById('use-websocket').checked;
    if (useWebSocket) {
        document.getElementById('crop-frame-container').classList.add('hidden');
        document.getElementById('annotated-frame-container').classList.add('hidden');
    } else if (currentCameraId) {
        fetchFrame();
    }
}

function clearStreamDisplay() {
    document.getElementById('crop-frame').src = '';
    document.getElementById('annotated-frame').src = '';
    document.getElementById('crop-frame-container').classList.add('hidden');
    document.getElementById('annotated-frame-container').classList.add('hidden');
}

function clearDetections() {
    document.getElementById('total-count').textContent = '0';
    document.getElementById('total-score').textContent = '0';
    document.getElementById('detection-table').innerHTML = '';
}