// --- 核心数据层 ---
let contactsData = JSON.parse(localStorage.getItem('my_archive_contacts')) || [];
let categoriesData = JSON.parse(localStorage.getItem('my_archive_categories')) || ['同学', '老师', '导师', '干事'];
let fileHandle = null; // 用于存储用户授权的文件句柄
let editingContactId = null; // 当前正在编辑的联系人ID

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

// 获取所有已存在的年级数据
function getExistingGrades() {
    const grades = new Set();
    
    contactsData.forEach(contact => {
        if (contact.grade) grades.add(contact.grade);
    });
    
    return Array.from(grades).sort();
}

// 渲染筛选下拉框
function renderFilterSelects() {
    // 学院筛选
    const collegeFilter = document.getElementById('collegeFilter');
    const existingColleges = getExistingCollegesAndMajors().colleges;
    const currentCollegeFilter = collegeFilter.value;
    
    collegeFilter.innerHTML = '<option value="全部">全部学院</option>';
    existingColleges.forEach(college => {
        const option = document.createElement('option');
        option.value = college;
        option.textContent = college;
        collegeFilter.appendChild(option);
    });
    if (existingColleges.includes(currentCollegeFilter)) {
        collegeFilter.value = currentCollegeFilter;
    }

    // 专业筛选
    const majorFilter = document.getElementById('majorFilter');
    const existingMajors = getExistingCollegesAndMajors().majors;
    const currentMajorFilter = majorFilter.value;
    
    majorFilter.innerHTML = '<option value="全部">全部专业</option>';
    existingMajors.forEach(major => {
        const option = document.createElement('option');
        option.value = major;
        option.textContent = major;
        majorFilter.appendChild(option);
    });
    if (existingMajors.includes(currentMajorFilter)) {
        majorFilter.value = currentMajorFilter;
    }

    // 年级筛选
    const gradeFilter = document.getElementById('gradeFilter');
    const existingGrades = getExistingGrades();
    const currentGradeFilter = gradeFilter.value;
    
    gradeFilter.innerHTML = '<option value="全部">全部年级</option>';
    existingGrades.forEach(grade => {
        const option = document.createElement('option');
        option.value = grade;
        option.textContent = grade;
        gradeFilter.appendChild(option);
    });
    if (existingGrades.includes(currentGradeFilter)) {
        gradeFilter.value = currentGradeFilter;
    }
}

// 更新年级选项（根据当前年份生成）
function updateGradeOptions() {
    const gradeSelect = document.getElementById('gradeInput');
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5; // 支持过去5年的学生
    const endYear = currentYear + 3;   // 支持未来3年的新生
    
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
    
    // 获取筛选条件
    const collegeFilter = document.getElementById('collegeFilter').value;
    const majorFilter = document.getElementById('majorFilter').value;
    const gradeFilter = document.getElementById('gradeFilter').value;
    const degreeFilter = document.getElementById('degreeFilter').value;
    
    contactsGrid.innerHTML = '';

    let filteredData = contactsData.filter(contact => {
        // 基础筛选：身份分类
        const matchFilter = filterValue === '全部' || contact.relation === filterValue;
        
        // 校园信息筛选
        const matchCollege = collegeFilter === '全部' || contact.college === collegeFilter;
        const matchMajor = majorFilter === '全部' || contact.major === majorFilter;
        const matchGrade = gradeFilter === '全部' || contact.grade === gradeFilter;
        const matchDegree = degreeFilter === '全部' || contact.degree === degreeFilter;
        
        // 搜索功能：支持所有个人信息字段
        const methodsStr = (contact.contactMethods || []).map(m => m.value).join(' ');
        const searchStr = `
            ${contact.name || ''}
            ${contact.relation || ''}
            ${methodsStr || ''}
            ${contact.college || ''}
            ${contact.major || ''}
            ${contact.grade || ''}
            ${contact.degree || ''}
            ${contact.className || ''}
            ${contact.studentId || ''}
            ${contact.notes.map(n => n.text).join(' ') || ''}
            ${contact.longNote || ''}
        `.toLowerCase();
        
        const matchSearch = searchTerm === '' || searchStr.includes(searchTerm);
        
        return matchFilter && matchCollege && matchMajor && matchGrade && matchDegree && matchSearch;
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
                        <button class="edit-time-btn" onclick="editNoteTime(${contact.id}, ${index})" title="修改时间">⏰</button>
                        <button class="delete-note-btn" onclick="deleteNote(${contact.id}, ${index})" title="删除备注">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
        if (contact.notes.length === 0) notesHtml = `<div class="note-item" style="color: #9ca3af;">暂无交流记录</div>`;

        // 大段备注显示
        let longNoteHtml = '';
        if (contact.longNote) {
            longNoteHtml = `
                <div class="long-note-section">
                    <div class="long-note-header">
                        <span class="long-note-title">个人备注</span>
                        <button class="edit-long-note-btn" onclick="editLongNote(${contact.id})" title="编辑个人备注">✏️ 编辑</button>
                    </div>
                    <div class="long-note-content">${contact.longNote}</div>
                </div>
            `;
        } else {
            longNoteHtml = `
                <div class="long-note-section">
                    <div class="long-note-header">
                        <span class="long-note-title">个人备注</span>
                        <button class="edit-long-note-btn" onclick="editLongNote(${contact.id})" title="添加个人备注">➕ 添加</button>
                    </div>
                    <div class="long-note-content empty">暂无个人备注，点击"添加"按钮创建</div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="card-header">
                <div><h3>${contact.name}</h3><span class="tag">${contact.relation}</span></div>
                <div class="card-actions">
                    <button class="edit-btn" onclick="editContact(${contact.id})">编辑</button>
                    <button class="delete-btn" onclick="deleteContact(${contact.id})">删除</button>
                </div>
            </div>
            ${methodsHtml} ${studentHtml}
            ${longNoteHtml}
            <div class="notes-section collapsed">
                <div class="notes-header">
                    <span class="notes-title">交流记录</span>
                    <button class="toggle-notes-btn" onclick="toggleNotes(${contact.id})" title="展开/折叠备注">▼</button>
                </div>
                <div class="notes-timeline" id="timeline-${contact.id}">${notesHtml}</div>
                <div class="add-note-box">
                    <input type="text" id="newNote-${contact.id}" placeholder="追加新备注..." onkeypress="if(event.key === 'Enter') appendNote(${contact.id})">
                    <button onclick="appendNote(${contact.id})">记录</button>
                </div>
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

// 修改备注时间戳
window.editNoteTime = function(contactId, noteIndex) {
    const contact = contactsData.find(c => c.id === contactId);
    if (!contact || !contact.notes[noteIndex]) return;
    
    const currentTimestamp = contact.notes[noteIndex].timestamp;
    const currentDate = new Date(currentTimestamp);
    
    // 创建时间选择对话框
    const timeDialog = document.createElement('div');
    timeDialog.style.position = 'fixed';
    timeDialog.style.top = '50%';
    timeDialog.style.left = '50%';
    timeDialog.style.transform = 'translate(-50%, -50%)';
    timeDialog.style.background = 'white';
    timeDialog.style.padding = '2rem';
    timeDialog.style.borderRadius = '8px';
    timeDialog.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    timeDialog.style.zIndex = '1000';
    timeDialog.style.minWidth = '300px';
    
    timeDialog.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 1rem;">修改时间</h3>
        <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #666;">日期</label>
            <input type="date" id="editDate" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #666;">时间</label>
            <input type="time" id="editTime" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="cancelTimeBtn" style="padding: 0.5rem 1rem; border: 1px solid #6b7280; background: #6b7280; color: white; border-radius: 4px; cursor: pointer;">取消</button>
            <button id="saveTimeBtn" style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button>
        </div>
    `;
    
    document.body.appendChild(timeDialog);
    
    // 设置当前时间值
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    
    document.getElementById('editDate').value = `${year}-${month}-${day}`;
    document.getElementById('editTime').value = `${hours}:${minutes}`;
    
    // 保存按钮事件
    document.getElementById('saveTimeBtn').addEventListener('click', () => {
        const dateStr = document.getElementById('editDate').value;
        const timeStr = document.getElementById('editTime').value;
        
        if (!dateStr || !timeStr) {
            alert('请填写完整的日期和时间');
            return;
        }
        
        // 合并日期和时间
        const newTimestamp = new Date(`${dateStr}T${timeStr}`).getTime();
        
        if (isNaN(newTimestamp)) {
            alert('时间格式错误');
            return;
        }
        
        contact.notes[noteIndex].timestamp = newTimestamp;
        saveData();
        document.body.removeChild(timeDialog);
    });
    
    // 取消按钮事件
    document.getElementById('cancelTimeBtn').addEventListener('click', () => {
        document.body.removeChild(timeDialog);
    });
    
    // 点击外部关闭
    timeDialog.addEventListener('click', (e) => {
        if (e.target === timeDialog) {
            document.body.removeChild(timeDialog);
        }
    });
};

// 编辑大段备注
window.editLongNote = function(contactId) {
    const contact = contactsData.find(c => c.id === contactId);
    if (!contact) return;
    
    const currentNote = contact.longNote || '';
    
    const longNoteDialog = document.createElement('div');
    longNoteDialog.style.position = 'fixed';
    longNoteDialog.style.top = '50%';
    longNoteDialog.style.left = '50%';
    longNoteDialog.style.transform = 'translate(-50%, -50%)';
    longNoteDialog.style.background = 'white';
    longNoteDialog.style.padding = '2rem';
    longNoteDialog.style.borderRadius = '8px';
    longNoteDialog.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    longNoteDialog.style.zIndex = '1000';
    longNoteDialog.style.minWidth = '400px';
    
    longNoteDialog.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 1rem;">编辑个人备注</h3>
        <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #666;">备注内容</label>
            <textarea id="longNoteText" style="width: 100%; min-height: 150px; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 0.95rem; resize: vertical;">${currentNote}</textarea>
        </div>
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="cancelLongNoteBtn" style="padding: 0.5rem 1rem; border: 1px solid #6b7280; background: #6b7280; color: white; border-radius: 4px; cursor: pointer;">取消</button>
            <button id="saveLongNoteBtn" style="padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button>
        </div>
    `;
    
    document.body.appendChild(longNoteDialog);
    
    // 保存按钮事件
    document.getElementById('saveLongNoteBtn').addEventListener('click', () => {
        const newText = document.getElementById('longNoteText').value.trim();
        contact.longNote = newText;
        saveData();
        document.body.removeChild(longNoteDialog);
    });
    
    // 取消按钮事件
    document.getElementById('cancelLongNoteBtn').addEventListener('click', () => {
        document.body.removeChild(longNoteDialog);
    });
    
    // 点击外部关闭
    longNoteDialog.addEventListener('click', (e) => {
        if (e.target === longNoteDialog) {
            document.body.removeChild(longNoteDialog);
        }
    });
};

// 个人备注折叠功能
function togglePersonalNotes() {
    const notesContainer = document.getElementById('personalNotesContainer');
    const toggleBtn = document.getElementById('togglePersonalNotesBtn');
    const notesContent = document.getElementById('personalNotesContent');
    
    if (notesContainer.classList.contains('collapsed')) {
        // 展开
        notesContainer.classList.remove('collapsed');
        notesContainer.style.height = 'auto';
        const height = notesContent.scrollHeight + 40 + 'px'; // 40px 为 padding
        notesContainer.style.height = height;
        toggleBtn.innerHTML = '收起个人备注 ▼';
        // 动画结束后移除固定高度
        setTimeout(() => {
            notesContainer.style.height = 'auto';
        }, 300);
    } else {
        // 折叠
        const height = notesContainer.scrollHeight + 'px';
        notesContainer.style.height = height;
        // 强制重绘
        notesContainer.offsetHeight;
        notesContainer.style.height = '0px';
        toggleBtn.innerHTML = '展开个人备注 ◀';
        // 动画结束后添加 collapsed 类
        setTimeout(() => {
            notesContainer.classList.add('collapsed');
        }, 300);
    }
}

// --- 编辑联系人功能 ---
function editContact(id) {
    const contact = contactsData.find(c => c.id === id);
    if (!contact) return;

    editingContactId = id;
    
    // 自动展开新建联系人区域
    const formContent = document.getElementById('formContent');
    const toggleFormBtn = document.getElementById('toggleFormBtn');
    if (formContent.classList.contains('collapsed')) {
        formContent.classList.remove('collapsed');
        toggleFormBtn.textContent = '▼';
    }
    
    // 切换到编辑模式
    document.getElementById('addBtn').style.display = 'none';
    document.getElementById('saveBtn').style.display = 'inline-block';
    document.getElementById('cancelBtn').style.display = 'inline-block';
    document.getElementById('editModeIndicator').style.display = 'block';
    
    // 更新标题为"编辑联系人"
    const formHeader = document.querySelector('.form-header h3');
    formHeader.textContent = '编辑联系人';
    
    // 填充表单数据
    nameInput.value = contact.name;
    relationSelect.value = contact.relation;
    customRelationInput.style.display = 'none';
    customRelationInput.value = '';
    
    // 填充联系方式
    methodsContainer.innerHTML = '';
    if (contact.contactMethods && contact.contactMethods.length > 0) {
        contact.contactMethods.forEach(method => {
            addMethodRow();
            const rows = methodsContainer.querySelectorAll('.method-row');
            const lastRow = rows[rows.length - 1];
            const typeSelect = lastRow.querySelector('.method-type');
            const customInput = lastRow.querySelector('.method-custom-name');
            const valueInput = lastRow.querySelector('.method-value');
            
            if (PREDEFINED_METHODS.includes(method.label)) {
                typeSelect.value = method.label;
                customInput.style.display = 'none';
            } else {
                typeSelect.value = '自定义';
                customInput.style.display = 'block';
                customInput.value = method.label;
            }
            valueInput.value = method.value;
        });
    } else {
        addMethodRow(); // 至少保留一行
    }
    
    // 填充校园信息
    document.getElementById('collegeInput').value = contact.college || '';
    document.getElementById('majorInput').value = contact.major || '';
    document.getElementById('gradeInput').value = contact.grade || '';
    document.getElementById('degreeInput').value = contact.degree || '本科';
    document.getElementById('classInput').value = contact.className || '';
    document.getElementById('studentIdInput').value = contact.studentId || '';
    
    // 显示校园信息区域
    if (!isCampusFieldsVisible) {
        campusToggleBtn.click();
    }
    
    // 重新初始化自动补全功能（确保编辑模式下也能使用）
    setupAutocomplete('collegeInput', 'collegeAutocomplete', 'college');
    setupAutocomplete('majorInput', 'majorAutocomplete', 'major');
    
    // 滚动到表单顶部
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

function saveContact() {
    if (!editingContactId) return;

    const name = nameInput.value.trim();
    if (!name) return alert('请填写姓名！');

    let relation = relationSelect.value;
    if (relation === '自定义') {
        relation = customRelationInput.value.trim();
        if (!relation) return alert('请填写自定义标签！');
        if (!categoriesData.includes(relation)) { categoriesData.push(relation); renderCategorySelects(); }
    }

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

    const contactMethods = [];
    document.querySelectorAll('.method-row').forEach(row => {
        const type = row.querySelector('.method-type').value;
        const value = row.querySelector('.method-value').value.trim();
        if (value) contactMethods.push({ label: type === '自定义' ? (row.querySelector('.method-custom-name').value.trim() || '其他') : type, value });
    });

    const updatedContact = {
        id: editingContactId,
        name, 
        relation, 
        contactMethods, 
        notes: contactsData.find(c => c.id === editingContactId).notes, // 保留原有备注
        college: document.getElementById('collegeInput').value.trim(),
        major: document.getElementById('majorInput').value.trim(),
        grade: grade,
        degree: document.getElementById('degreeInput').value.trim(),
        className: document.getElementById('classInput').value.trim(),
        studentId: document.getElementById('studentIdInput').value.trim()
    };

    // 更新联系人数据
    const index = contactsData.findIndex(c => c.id === editingContactId);
    if (index !== -1) {
        contactsData[index] = updatedContact;
        saveData();
        exitEditMode();
    }
}

function cancelEdit() {
    exitEditMode();
}

function exitEditMode() {
    editingContactId = null;
    
    // 恢复到添加模式
    document.getElementById('addBtn').style.display = 'inline-block';
    document.getElementById('saveBtn').style.display = 'none';
    document.getElementById('cancelBtn').style.display = 'none';
    document.getElementById('editModeIndicator').style.display = 'none';
    
    // 恢复标题为"新建联系人"
    const formHeader = document.querySelector('.form-header h3');
    formHeader.textContent = '新建联系人';
    
    // 重置表单
    ['nameInput', 'initialNoteInput', 'collegeInput', 'majorInput', 'gradeInput', 'classInput', 'studentIdInput'].forEach(id => document.getElementById(id).value = '');
    relationSelect.value = categoriesData[0];
    customRelationInput.style.display = 'none';
    customRelationInput.value = '';
    customGradeInput.style.display = 'none';
    customGradeInput.value = '';
    methodsContainer.innerHTML = '';
    addMethodRow(); // 恢复默认的1行联系方式
    nameInput.focus();
}

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

// 筛选功能事件监听
document.getElementById('collegeFilter').addEventListener('change', renderContacts);
document.getElementById('majorFilter').addEventListener('change', renderContacts);
document.getElementById('gradeFilter').addEventListener('change', renderContacts);
document.getElementById('degreeFilter').addEventListener('change', renderContacts);
document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);

// 编辑功能事件监听
document.getElementById('saveBtn').addEventListener('click', saveContact);
document.getElementById('cancelBtn').addEventListener('click', cancelEdit);

// 清除所有筛选条件
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterSelect').value = '全部';
    document.getElementById('collegeFilter').value = '全部';
    document.getElementById('majorFilter').value = '全部';
    document.getElementById('gradeFilter').value = '全部';
    document.getElementById('degreeFilter').value = '全部';
    renderContacts();
}

// --- 联系人卡片折叠功能 ---
function toggleNotes(contactId) {
    const notesSection = document.querySelector(`.contact-card:has(#timeline-${contactId}) .notes-section`);
    const toggleBtn = document.querySelector(`.contact-card:has(#timeline-${contactId}) .toggle-notes-btn`);
    
    if (notesSection && toggleBtn) {
        const isCollapsed = notesSection.classList.contains('collapsed');
        notesSection.classList.toggle('collapsed', !isCollapsed);
        toggleBtn.textContent = isCollapsed ? '▼' : '▶';
    }
}

// 初始化所有联系人卡片的交流记录为折叠状态
function initializeNotesCollapsed() {
    const allToggleBtns = document.querySelectorAll('.toggle-notes-btn');
    allToggleBtns.forEach(btn => {
        btn.textContent = '▶'; // 初始化为右箭头
    });
}

// --- 折叠功能 ---
function setupCollapsibleSections() {
    const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
    const filtersContent = document.getElementById('filtersContent');
    const toggleFormBtn = document.getElementById('toggleFormBtn');
    const formContent = document.getElementById('formContent');
    
    // 筛选区域折叠
    toggleFiltersBtn.addEventListener('click', () => {
        const isCollapsed = filtersContent.classList.contains('collapsed');
        filtersContent.classList.toggle('collapsed', !isCollapsed);
        toggleFiltersBtn.textContent = isCollapsed ? '▼' : '◀';
    });
    
    // 新建联系人表单折叠
    toggleFormBtn.addEventListener('click', () => {
        const isCollapsed = formContent.classList.contains('collapsed');
        formContent.classList.toggle('collapsed', !isCollapsed);
        toggleFormBtn.textContent = isCollapsed ? '▼' : '◀';
    });
    
    // 搜索和筛选时自动折叠新建联系人表单
    const searchInput = document.getElementById('searchInput');
    const filterSelect = document.getElementById('filterSelect');
    const collegeFilter = document.getElementById('collegeFilter');
    const majorFilter = document.getElementById('majorFilter');
    const gradeFilter = document.getElementById('gradeFilter');
    const degreeFilter = document.getElementById('degreeFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    function autoCollapseForm() {
        if (!formContent.classList.contains('collapsed')) {
            formContent.classList.add('collapsed');
            toggleFormBtn.textContent = '◀';
        }
    }
    
    // 为所有筛选和搜索元素添加事件监听
    [searchInput, filterSelect, collegeFilter, majorFilter, gradeFilter, degreeFilter].forEach(element => {
        element.addEventListener('input', autoCollapseForm);
        element.addEventListener('change', autoCollapseForm);
    });
    
    // 清除筛选按钮点击时也折叠表单
    clearFiltersBtn.addEventListener('click', autoCollapseForm);
}

// 初始化
renderCategorySelects();
renderFilterSelects(); // 添加筛选下拉框的初始化
renderContacts();
addMethodRow(); // 初始给一行联系方式输入框

// 设置自动补全功能
setupAutocomplete('collegeInput', 'collegeAutocomplete', 'college');
setupAutocomplete('majorInput', 'majorAutocomplete', 'major');

// 设置折叠功能
setupCollapsibleSections();

// 初始化所有联系人卡片的交流记录为折叠状态
initializeNotesCollapsed();


