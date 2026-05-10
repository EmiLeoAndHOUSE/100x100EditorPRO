import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- CONFIGURAZIONE INIZIALE ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const viewport = document.getElementById('viewport');
const camera = new THREE.PerspectiveCamera(75, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Luci
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// Griglia
const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
scene.add(gridHelper);

// --- LOGICA TOOLTIP ---
const tooltip = document.getElementById('tooltip');
document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) {
        tooltip.textContent = target.getAttribute('data-tooltip');
        tooltip.style.opacity = '1';
    }
});

document.addEventListener('mousemove', (e) => {
    if (tooltip.style.opacity === '1') {
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
    }
});

document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) {
        tooltip.style.opacity = '0';
    }
});

// --- STATO DELL'EDITOR ---
let objects = [];
let selectedObject = null;
let currentTool = 'select'; // select, move, rotate
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- FUNZIONI CORE ---

function updateHierarchy() {
    const list = document.getElementById('hierarchy-list');
    list.innerHTML = '';
    
    if (objects.length === 0) {
        list.innerHTML = '<div style="color: var(--text-dim); font-size: 11px;">Nessun oggetto nella scena</div>';
        return;
    }

    objects.forEach((obj, index) => {
        const item = document.createElement('div');
        item.style.padding = '5px';
        item.style.cursor = 'pointer';
        item.style.fontSize = '12px';
        item.style.borderBottom = '1px solid #333';
        item.style.backgroundColor = selectedObject === obj ? 'var(--accent)' : 'transparent';
        item.textContent = `${obj.name || 'Oggetto'} #${index}`;
        
        item.onclick = () => selectObject(obj);
        list.appendChild(item);
    });
}

function selectObject(obj) {
    if (selectedObject) {
        // Rimuovi effetto selezione precedente (es. wireframe o emissivo)
        if (selectedObject.material.emissive) selectedObject.material.emissive.setHex(0x000000);
    }

    selectedObject = obj;
    
    if (selectedObject) {
        if (selectedObject.material.emissive) selectedObject.material.emissive.setHex(0x333333);
        updateInspector();
    } else {
        document.getElementById('inspector-content').innerHTML = '<div style="color: var(--text-dim); text-align: center; margin-top: 20px;">Seleziona un oggetto</div>';
    }
    
    updateHierarchy();
}

function updateInspector() {
    if (!selectedObject) return;

    const content = document.getElementById('inspector-content');
    content.innerHTML = `
        <div class="inspector-group">
            <label>NOME</label>
            <input type="text" class="inspector-field" value="${selectedObject.name}" id="inspect-name">
        </div>
        <div class="inspector-group">
            <label>POSIZIONE (X, Y, Z)</label>
            <div class="inspector-row">
                <input type="number" class="inspector-field" step="0.5" value="${selectedObject.position.x}" id="inspect-pos-x">
                <input type="number" class="inspector-field" step="0.5" value="${selectedObject.position.y}" id="inspect-pos-y">
                <input type="number" class="inspector-field" step="0.5" value="${selectedObject.position.z}" id="inspect-pos-z">
            </div>
        </div>
        <div class="inspector-group">
            <label>ROTAZIONE (Y)</label>
            <input type="number" class="inspector-field" step="15" value="${THREE.MathUtils.radToDeg(selectedObject.rotation.y)}" id="inspect-rot-y">
        </div>
        <div class="inspector-group">
            <label>COLORE</label>
            <input type="color" class="inspector-field" value="#${selectedObject.material.color.getHexString()}" id="inspect-color">
        </div>
        <button class="toolbar-btn" style="width: 100%; background: #c0392b; margin-top: 10px;" id="btn-delete">Elimina Oggetto</button>
    `;

    // Eventi Ispettore
    document.getElementById('inspect-name').oninput = (e) => { selectedObject.name = e.target.value; updateHierarchy(); };
    document.getElementById('inspect-pos-x').oninput = (e) => selectedObject.position.x = parseFloat(e.target.value);
    document.getElementById('inspect-pos-y').oninput = (e) => selectedObject.position.y = parseFloat(e.target.value);
    document.getElementById('inspect-pos-z').oninput = (e) => selectedObject.position.z = parseFloat(e.target.value);
    document.getElementById('inspect-rot-y').oninput = (e) => selectedObject.rotation.y = THREE.MathUtils.degToRad(parseFloat(e.target.value));
    document.getElementById('inspect-color').oninput = (e) => selectedObject.material.color.set(e.target.value);
    document.getElementById('btn-delete').onclick = () => {
        scene.remove(selectedObject);
        objects = objects.filter(o => o !== selectedObject);
        selectObject(null);
    };
}

function addObject(type) {
    let geometry, material, mesh;
    material = new THREE.MeshStandardMaterial({ color: 0x3498db });

    switch(type) {
        case 'cube':
            geometry = new THREE.BoxGeometry(1, 1, 1);
            mesh = new THREE.Mesh(geometry, material);
            mesh.name = "Cubo";
            break;
        case 'sphere':
            geometry = new THREE.SphereGeometry(0.6, 32, 32);
            mesh = new THREE.Mesh(geometry, material);
            mesh.name = "Sfera";
            break;
        case 'tree':
            // Semplice albero con gruppo
            const group = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 0.3), new THREE.MeshStandardMaterial({color: 0x5d4037}));
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 8), new THREE.MeshStandardMaterial({color: 0x2e7d32}));
            leaves.position.y = 1;
            group.add(trunk);
            group.add(leaves);
            mesh = group;
            mesh.name = "Albero";
            // Mock material for generic handling
            mesh.material = { color: { getHexString: () => "2e7d32", set: () => {} } };
            break;
        case 'floor':
            geometry = new THREE.PlaneGeometry(2, 2);
            mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide }));
            mesh.rotation.x = -Math.PI / 2;
            mesh.name = "Terreno";
            break;
    }

    if (mesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        objects.push(mesh);
        selectObject(mesh);
    }
}

// --- GESTIONE INPUT ---

viewport.addEventListener('mousedown', (event) => {
    // Calcola posizione mouse normalizzata
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
        // Trova l'oggetto radice se è un gruppo
        let obj = intersects[0].object;
        while(obj.parent && obj.parent !== scene) obj = obj.parent;
        selectObject(obj);
    } else {
        if (event.button === 0) selectObject(null);
    }
});

// Bottoni Toolbar
document.getElementById('btn-select').onclick = () => setTool('select');
document.getElementById('btn-move').onclick = () => setTool('move');
document.getElementById('btn-rotate').onclick = () => setTool('rotate');

function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${tool}`).classList.add('active');
}

// Asset Library
document.querySelectorAll('.asset-item').forEach(item => {
    item.onclick = () => addObject(item.dataset.type);
});

// Salvataggio / Caricamento
document.getElementById('btn-save').onclick = () => {
    const data = objects.map(obj => ({
        type: obj.name,
        name: obj.name,
        pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rot: { y: obj.rotation.y },
        color: obj.material && obj.material.color ? obj.material.color.getHex() : 0xffffff
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mappa_gioco.json';
    a.click();
};

document.getElementById('btn-load').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (re) => {
            const data = JSON.parse(re.target.result);
            // Pulisci scena
            objects.forEach(o => scene.remove(o));
            objects = [];
            
            data.forEach(d => {
                // Semplificazione: ricreiamo i cubi come esempio
                addObject('cube');
                const obj = objects[objects.length - 1];
                obj.name = d.name;
                obj.position.set(d.pos.x, d.pos.y, d.pos.z);
                obj.rotation.y = d.rot.y;
                if (obj.material) obj.material.color.setHex(d.color);
            });
            updateHierarchy();
        };
        reader.readAsText(file);
    };
    input.click();
};

// --- LOOP DI ANIMAZIONE ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Gestione ridimensionamento
window.addEventListener('resize', () => {
    camera.aspect = viewport.clientWidth / viewport.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
});

animate();
updateHierarchy();
console.log("Editor Inizializzato con successo.");
