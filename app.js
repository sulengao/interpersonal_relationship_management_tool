// --- 核心数据层 ---
let contactsData = JSON.parse(localStorage.getItem('my_archive_contacts')) || [];
let categoriesData = JSON.parse(localStorage.getItem('my_archive_categories')) || ['同学', '老师', '导师', '干事'];
let fileHandle = null; // 用于存储用户授权的文件句柄

// --- DOM 获取 ---
const nameInput = document.getElementById('nameInput');
const relationSelect = document.getElementById('relationSelect');
const customRelationInput = document.getElementById('customRelationInput');
const methodsContainer = document.getElementById('methodsContainer');
const initialNoteInput = document.getElementById('initialNoteInput');
const campusToggleBtn = document.getElementById('campusToggleBtn');
const studentFields = document.getElementById('studentFields');
const searchInput = document.getElementById('searchInput');
const filterSelect = document.getElementById('filterSelect');
const contactsGrid = document.getElementById('contactsGrid');
const importFileInput = document.getElementById('importFileInput');
const syncStatus = document.getElementById('syncStatus');

const PREDEFINED_METHODS = ['微信', 'QQ', '电话', '邮箱', '自定义'];
let isCampusFieldsVisible = false;

// --- 自动补全相关变量 ---
let collegeAutocompleteVisible = false;
let majorAutocompleteVisible = false;
let selectedCollegeIndex = -1;
let selectedMajorIndex = -1;

// --- 自动同步 & 文件管理功能 ---
async function setupAutoSyncFile() {
    try {
        // 请求用户选择一个文件用于持续保存
        const options = {
            suggestedName: '人际关系图谱_自动存档.json',
            types: [{ description: 'JSON 存档文件', accept: {'application/json': ['.json']} }]
        };
        fileHandle = await window.showSaveFilePicker(options);
        syncStatus.innerHTML = '🟢 已连接自动存档';
        syncStatus.style.color = 'var(--success-color)';
        saveData(); // 立刻将当前缓存数据同步进去
    } catch (error) {
        console.log('取消选择或不支持API', error);
    }
}

async function writeToFile() {
    if (!fileHandle) return; // 如果没连文件，就跳过写入（但 localStorage 依然会存）
    try {
        const writable = await fileHandle.createWritable();
        const archive = { version: "1.2", exportTime: new Date().toISOString(), categories: categoriesData, contacts: contactsData };
        await writable.write(JSON.stringify(archive, null, 2));
        await writable.close();
    } catch (error) {
        syncStatus.innerHTML = '🔴 自动保存失败，文件可能被移动';
        syncStatus.style.color = '#ef4444';
        fileHandle = null;
    }
}

function exportData() {
    const archive = { version: "1.2", exportTime: new Date().toISOString(), categories: categoriesData, contacts: contactsData };
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `人际关系存档_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

importFileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const imported = JSON.parse(event.target.result);
            if (imported.contacts) {
                contactsData = imported.contacts;
                categoriesData = imported.categories || categoriesData;
                saveData();
                renderCategorySelects();
                alert('✅ 导入成功！如已连接同步文件，新数据已同步保存。');
            }
        } catch (err) { alert('❌ 解析存档文件失败。'); }
        importFileInput.value = '';
    };
    reader.readAsText(file);
});

// --- 智能联系方式管理 ---
function getNextAvailableMethod() {
    // 获取当前界面上已经选择的联系方式类型
    const usedMethods = Array.from(document.querySelectorAll('.method-type')).map(select => select.value);
    // 遍历预设列表，返回第一个还没被使用的
    for (let method of PREDEFINED_METHODS) {
        if (!usedMethods.includes(method) && method !== '自定义') {
            return method;
        }
    }
    return '自定义'; // 如果微信、QQ等都选过了，默认给自定义
}

function addMethodRow() {
    const nextMethod = getNextAvailableMethod();
    const row = document.createElement('div');
    row.className = 'method-row';
    
    // 生成 options 的 HTML，并默认选中 nextMethod
    const optionsHtml = PREDEFINED_METHODS.map(m => 
        `<option value="${m}" ${m === nextMethod ? 'selected' : ''}>${m}</option>`
    ).join('');

    row.innerHTML = `
        <select class="method-type" onchange="toggleMethodInput(this)" style="width: 100px;">
            ${optionsHtml}
        </select>
        <input type="text" class="method-custom-name" placeholder="平台名称" style="display:${nextMethod === '自定义' ? 'block' : 'none'}; width: 80px;">
        <input type="text" class="method-value" placeholder="号码或账号" style="flex: 1;">
        <button type="button" class="remove-row-btn" onclick="this.parentElement.remove()">×</button>
    `;
    methodsContainer.appendChild(row);
}

window.toggleMethodInput = function(selectEl) {
    const customInput = selectEl.nextElementSibling;
    if (selectEl.value === '自定义') {
        customInput.style.display = 'block'; customInput.focus();
    } else {
        customInput.style.display = 'none'; customInput.value = '';
    }
};

// --- 分类与UI交互 ---
function renderCategorySelects() {
    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = '<option value="全部">全部分类</option>';
    categoriesData.forEach(cat => filterSelect.innerHTML += `<option value="${cat}">${cat}</option>`);
    if (categoriesData.includes(currentFilter) || currentFilter === '全部') filterSelect.value = currentFilter;

    relationSelect.innerHTML = '';
    categoriesData.forEach(cat => relationSelect.innerHTML += `<option value="${cat}">${cat}</option>`);
    relationSelect.innerHTML += `<option value="自定义">➕ 添加新标签...</option>`;
}

relationSelect.addEventListener('change', function() {
    if (this.value === '自定义') {
        customRelationInput.style.display = 'block'; customRelationInput.focus();
    } else {
        customRelationInput.style.display = 'none'; customRelationInput.value = '';
    }
});

campusToggleBtn.addEventListener('click', () => {
    isCampusFieldsVisible = !isCampusFieldsVisible;
    if (isCampusFieldsVisible) {
        studentFields.style.display = 'flex'; campusToggleBtn.innerText = '➖ 收起校园信息';
        updateGradeOptions(); // 初始化年级选项
    } else {
        studentFields.style.display = 'none'; campusToggleBtn.innerText = '➕ 展开校园信息 (学院/专业/年级/学历/班级)';
    }
});

// --- 校园信息优化功能 ---

// 获取所有已存在的学院和专业数据
function getExistingCollegesAndMajors() {
    const colleges = new Set();
    const majors = new Set();
    
    contactsData.forEach(contact => {
        if (contact.college) colleges.add(contact.college);
        if (contact.major) majors.add(contact.major);
    });
    
    return {
        colleges: Array.from(colleges).sort(),
        majors: Array.from(majors).sort()
    };
}

// 更新年级选项（根据当前年份生成）
function updateGradeOptions() {
    const gradeSelect = document.getElementById('gradeInput');
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5; // 支持过去5年的学生
    const endYear = currentYear + 2;   // 支持未来2年的新生
    
    // 清空现有选项（保留第一个"选择年级"选项）
    gradeSelect.innerHTML = '<option value="">选择年级</option>';
    
    for (let year = endYear; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = `${year}级`;
        option.textContent = `${year}级`;
        gradeSelect.appendChild(option);
    }
    
    // 添加自定义年级选项
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = '➕ 自定义年级...';
    gradeSelect.appendChild(customOption);
    
    // 默认选择2025级
    gradeSelect.value = '2025级';
}

// 处理年级选择变化
function handleGradeChange(select) {
    const customInput = document.getElementById('customGradeInput');
    if (select.value === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
}

// 自动补全功能
function setupAutocomplete(inputId, dropdownId, dataGetter) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    
    input.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        const { colleges, majors } = getExistingCollegesAndMajors();
        const data = dataGetter === 'college' ? colleges : majors;
        
        if (query.length < 1) {
            hideAutocomplete(dropdownId);
            return;
        }
        
        const matches = data.filter(item => 
            item.toLowerCase().includes(query)
        );
        
        if (matches.length > 0) {
            showAutocomplete(dropdownId, matches, inputId);
        } else {
            hideAutocomplete(dropdownId);
        }
    });
    
    input.addEventListener('focus', function() {
        if (this.value.length > 0) {
            const query = this.value.toLowerCase();
            const { colleges, majors } = getExistingCollegesAndMajors();
            const data = dataGetter === 'college' ? colleges : majors;
            const matches = data.filter(item => item.toLowerCase().includes(query));
            if (matches.length > 0) {
                showAutocomplete(dropdownId, matches, inputId);
            }
        }
    });
    
    input.addEventListener('keydown', function(e) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const selectedIndex = Array.from(items).findIndex(item => item.classList.contains('selected'));
            const nextIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
            updateSelection(items, nextIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const selectedIndex = Array.from(items).findIndex(item => item.classList.contains('selected'));
            const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
            updateSelection(items, prevIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selectedItem = dropdown.querySelector('.autocomplete-item.selected');
            if (selectedItem) {
                input.value = selectedItem.textContent;
                hideAutocomplete(dropdownId);
            }
        } else if (e.key === 'Escape') {
            hideAutocomplete(dropdownId);
        }
    });
    
    // 点击选项
    dropdown.addEventListener('click', function(e) {
        if (e.target.classList.contains('autocomplete-item')) {
            input.value = e.target.textContent;
            hideAutocomplete(dropdownId);
            input.focus();
        }
    });
    
    // 点击外部关闭
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            hideAutocomplete(dropdownId);
        }
    });
}

function showAutocomplete(dropdownId, items, inputId) {
    const dropdown = document.getElementById(dropdownId);
    dropdown.innerHTML = '';
    
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.textContent = item;
        if (index === 0) div.classList.add('selected');
        dropdown.appendChild(div);
    });
    
    dropdown.style.display = 'block';
    
    // 设置位置 - 修复定位问题
    const input = document.getElementById(inputId);
    const inputRect = input.getBoundingClientRect();
    const containerRect = input.closest('.input-group').getBoundingClientRect();
    
    // 相对于父容器定位
    dropdown.style.position = 'absolute';
    dropdown.style.top = (inputRect.bottom - containerRect.top + 5) + 'px';
    dropdown.style.left = '0';
    dropdown.style.width = '100%';
    
    // 确保不会超出视窗
    const viewportWidth = window.innerWidth;
    const dropdownWidth = dropdown.offsetWidth;
    const inputLeft = inputRect.left;
    
    if (inputLeft + dropdownWidth > viewportWidth) {
        dropdown.style.left = (viewportWidth - inputLeft - dropdownWidth) + 'px';
    }
}

function hideAutocomplete(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
}

function updateSelection(items, index) {
    items.forEach(item => item.classList.remove('selected'));
    items[index].classList.add('selected');
}

// --- 核心渲染与数据逻辑 ---
function formatDate(timestamp) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function renderContacts() {
    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = filterSelect.value;
    contactsGrid.innerHTML = '';

    let filteredData = contactsData.filter(contact => {
        const matchFilter = filterValue === '全部' || contact.relation === filterValue;
        const methodsStr = (contact.contactMethods || []).map(m => m.value).join(' ');
        const searchStr = `${contact.name} ${methodsStr} ${contact.college || ''} ${contact.major || ''} ${contact.notes.map(n=>n.text).join(' ')}`.toLowerCase();
        return matchFilter && searchStr.includes(searchTerm);
    });

    [...filteredData].reverse().forEach(contact => {
        const card = document.createElement('div');
        card.className = 'contact-card';
        
        let methodsHtml = '';
        if (contact.contactMethods && contact.contactMethods.length > 0) {
            methodsHtml = `<div class="social-info">`;
            contact.contactMethods.forEach(m => methodsHtml += `<span><b>${m.label}:</b> ${m.value}</span>`);
            methodsHtml += `</div>`;
        }

        let studentHtml = '';
        if (contact.college || contact.major || contact.grade || contact.className || contact.studentId) {
            studentHtml = `<div class="student-info">`;
            if (contact.college || contact.major) studentHtml += `<p>🏛️ ${contact.college || ''} ${contact.major || ''}</p>`;
            if (contact.grade || contact.className) studentHtml += `<p>🏫 ${contact.grade || ''} ${contact.className || ''}</p>`;
            if (contact.studentId) studentHtml += `<p>💳 学号: ${contact.studentId}</p>`;
            studentHtml += `</div>`;
        }

        let notesHtml = contact.notes.map((note, index) => `
            <div class="note-item">
                <span class="note-time">${formatDate(note.timestamp)}</span>
                <div class="note-content">
                    <span class="note-text">${note.text}</span>
                    <div class="note-actions">
                        <button class="edit-note-btn" onclick="editNote(${contact.id}, ${index})" title="编辑备注">✏️</button>
                        <button class="delete-note-btn" onclick="deleteNote(${contact.id}, ${index})" title="删除备注">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
        if (contact.notes.length === 0) notesHtml = `<div class="note-item" style="color: #9ca3af;">暂无交流记录</div>`;

        card.innerHTML = `
            <div class="card-header">
                <div><h3>${contact.name}</h3><span class="tag">${contact.relation}</span></div>
                <button class="delete-btn" onclick="deleteContact(${contact.id})">删除</button>
            </div>
            ${methodsHtml} ${studentHtml}
            <div class="notes-timeline" id="timeline-${contact.id}">${notesHtml}</div>
            <div class="add-note-box">
                <input type="text" id="newNote-${contact.id}" placeholder="追加新备注..." onkeypress="if(event.key === 'Enter') appendNote(${contact.id})">
                <button onclick="appendNote(${contact.id})">记录</button>
            </div>
        `;
        contactsGrid.appendChild(card);
    });
}

document.getElementById('addBtn').addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) return alert('请填写姓名！');

    let relation = relationSelect.value;
    if (relation === '自定义') {
        relation = customRelationInput.value.trim();
        if (!relation) return alert('请填写自定义标签！');
        if (!categoriesData.includes(relation)) { categoriesData.push(relation); renderCategorySelects(); }
    }

    const contactMethods = [];
    document.querySelectorAll('.method-row').forEach(row => {
        const type = row.querySelector('.method-type').value;
        const value = row.querySelector('.method-value').value.trim();
        if (value) contactMethods.push({ label: type === '自定义' ? (row.querySelector('.method-custom-name').value.trim() || '其他') : type, value });
    });

    // 处理年级选择
    const gradeSelect = document.getElementById('gradeInput');
    const customGradeInput = document.getElementById('customGradeInput');
    let grade = gradeSelect.value;
    
    // 如果选择了自定义年级，使用自定义输入框的值
    if (grade === 'custom' && customGradeInput.value.trim()) {
        grade = customGradeInput.value.trim();
    } else if (grade === 'custom') {
        grade = ''; // 如果没有输入自定义年级，留空
    }

    const newContact = {
        id: Date.now(), 
        name, 
        relation, 
        contactMethods, 
        notes: [],
        college: document.getElementById('collegeInput').value.trim(),
        major: document.getElementById('majorInput').value.trim(),
        grade: grade,
        className: document.getElementById('classInput').value.trim(),
        studentId: document.getElementById('studentIdInput').value.trim()
    };

    const initialNote = initialNoteInput.value.trim();
    if (initialNote) newContact.notes.push({ timestamp: Date.now(), text: initialNote });

    contactsData.push(newContact);
    saveData();

    // 重置表单
    ['nameInput', 'initialNoteInput', 'collegeInput', 'majorInput', 'gradeInput', 'classInput', 'studentIdInput'].forEach(id => document.getElementById(id).value = '');
    relationSelect.value = categoriesData[0];
    customRelationInput.style.display = 'none';
    customGradeInput.style.display = 'none';
    customGradeInput.value = '';
    methodsContainer.innerHTML = ''; addMethodRow(); // 恢复默认的1行联系方式
    nameInput.focus();
});

window.appendNote = function(id) {
    const inputEl = document.getElementById(`newNote-${id}`);
    const text = inputEl.value.trim();
    if (!text) return;
    const contact = contactsData.find(c => c.id === id);
    if (contact) {
        contact.notes.push({ timestamp: Date.now(), text: text });
        saveData();
        setTimeout(() => { const tl = document.getElementById(`timeline-${id}`); if(tl) tl.scrollTop = tl.scrollHeight; }, 0);
    }
};

window.deleteContact = function(id) {
    if(confirm('确定要删除这条档案吗？')) { contactsData = contactsData.filter(c => c.id !== id); saveData(); }
};

// 编辑备注（不改变时间戳）
window.editNote = function(contactId, noteIndex) {
    const contact = contactsData.find(c => c.id === contactId);
    if (!contact || !contact.notes[noteIndex]) return;
    
    const newText = prompt('编辑备注:', contact.notes[noteIndex].text);
    if (newText !== null && newText.trim() !== '') {
        contact.notes[noteIndex].text = newText.trim();
        saveData();
    }
};

// 删除备注
window.deleteNote = function(contactId, noteIndex) {
    const contact = contactsData.find(c => c.id === contactId);
    if (!contact || !contact.notes[noteIndex]) return;
    
    if (confirm('确定要删除这条备注吗？')) {
        contact.notes.splice(noteIndex, 1);
        saveData();
    }
};

async function saveData() {
    // 1. 保存在浏览器的 localStorage 作为热备
    localStorage.setItem('my_archive_contacts', JSON.stringify(contactsData));
    localStorage.setItem('my_archive_categories', JSON.stringify(categoriesData));
    renderContacts();
    
    // 2. 如果用户开启了自动同步，则覆写本地文件
    await writeToFile();
}

searchInput.addEventListener('input', renderContacts);
filterSelect.addEventListener('change', renderContacts);

// 初始化
renderCategorySelects();
renderContacts();
addMethodRow(); // 初始给一行联系方式输入框

// 设置自动补全功能
setupAutocomplete('collegeInput', 'collegeAutocomplete', 'college');
setupAutocomplete('majorInput', 'majorAutocomplete', 'major');
