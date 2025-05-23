// 全域變數
let items = []; // 儲存願望清單商品的陣列
let allTags = new Set(); // 儲存所有商品標籤的 Set
let currentUser = null; // 當前登入的使用者名稱
let isDataSynced = false; // 檢查資料是否已從伺服器載入或本地檔案讀取
let isDataChanged = false; // 檢查資料是否有未儲存的變動

// API 基本 URL (請替換為您的實際後端 URL)
// 根據您提供的 Flask 後端，其運行在 5001 埠
const API_BASE_URL = 'http://127.0.0.1:5001'; // 或 'http://localhost:5001'

// =====================================
// 輔助函數
// =====================================

/**
 * 顯示一個 Materialize Toast 通知
 * @param {string} message - 要顯示的訊息
 * @param {string} type - 訊息類型 ('success', 'error', 'warning')
 */
function showToast(message, type = 'info') {
    let classes = '';
    switch (type) {
        case 'success':
            classes = 'green darken-2';
            break;
        case 'error':
            classes = 'red darken-2';
            break;
        case 'warning':
            classes = 'orange darken-2';
            break;
        case 'info':
        default:
            classes = 'blue darken-2';
            break;
    }
    M.toast({ html: message, classes: classes, displayLength: 3000 });
}

/**
 * 獲取並處理圖片檔案或 URL
 * @param {File | null} file - 圖片檔案物件
 * @param {string} url - 圖片 URL
 * @returns {Promise<string>} - 返回 Base64 編碼的圖片字串或 URL
 */
async function getImageData(file, url) {
    if (file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    } else if (url) {
        return url;
    }
    return ''; // 無圖片
}

/**
 * 重置新增商品模態框的表單
 */
function resetForm() {
    document.getElementById('itemTitle').value = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('itemUrl').value = '';
    document.getElementById('itemNote').value = '';
    document.getElementById('purchasedSwitch').checked = false;
    document.getElementById('imageUpload').value = '';
    document.getElementById('imageUrl').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('previewImage').src = '';
    // 重置標籤 Chips
    const chipsInstance = M.Chips.getInstance(document.getElementById('tagChips'));
    if (chipsInstance) {
        chipsInstance.chipsData.forEach(() => chipsInstance.deleteChip(0));
    }
    // 重置截止日期並設定回預設值
    document.getElementById('itemDeadline').value = '';
    const datepickerInstance = M.Datepicker.getInstance(document.getElementById('itemDeadline'));
    if (datepickerInstance) {
        const defaultDate = new Date(2099, 11, 31); // 2099年12月31日
        datepickerInstance.setDate(defaultDate);
        datepickerInstance.gotoDate(defaultDate);
    }
    M.updateTextFields(); // 確保標籤縮小
}

/**
 * 重置編輯商品模態框的表單
 */
function resetEditForm() {
    document.getElementById('editItemId').value = '';
    document.getElementById('editItemTitle').value = '';
    document.getElementById('editItemPrice').value = '';
    document.getElementById('editItemUrl').value = '';
    document.getElementById('editItemNote').value = '';
    document.getElementById('editPurchasedSwitch').checked = false;
    document.getElementById('editImageUpload').value = '';
    document.getElementById('editImageUrl').value = '';
    document.getElementById('editImagePreview').style.display = 'none';
    document.getElementById('editPreviewImage').src = '';
    // 重置標籤 Chips
    const chipsInstance = M.Chips.getInstance(document.getElementById('editTagChips'));
    if (chipsInstance) {
        chipsInstance.chipsData.forEach(() => chipsInstance.deleteChip(0));
    }
    // 重置截止日期並設定回預設值
    document.getElementById('editItemDeadline').value = '';
    const datepickerInstance = M.Datepicker.getInstance(document.getElementById('editItemDeadline'));
    if (datepickerInstance) {
        const defaultDate = new Date(2099, 11, 31); // 2099年12月31日
        datepickerInstance.setDate(defaultDate);
        datepickerInstance.gotoDate(defaultDate);
    }
    M.updateTextFields(); // 確保標籤縮小
}

// =====================================
// 數據處理和儲存
// =====================================

/**
 * 從伺服器載入用戶資料
 */
async function loadData() {
    document.querySelector('.loading').style.display = 'block'; // 顯示載入中
    try {
        // 根據後端 API，登入操作本身會返回資料
        // 所以這裡不需要額外發送 fetch 請求來 "載入" 資料
        // 資料會在 loginOrRegister 成功後設定
        if (currentUser && currentUser !== "訪客") {
            // 如果已經登入（非訪客模式），則假設資料已經在登入時載入
            // 如果您希望在頁面重新整理後能自動載入，您需要一個新的 /api/data/<username> 端點
            // 目前的後端設計，/api/login 已經包含了獲取資料的功能
            // 所以這裡直接重新渲染即可，除非有特定的刷新邏輯
            showToast('資料已更新顯示', 'info'); // 假設資料已在登入時載入
        } else {
            // 訪客模式或未登入，載入預設數據
            loadDefaultData();
            showToast('未登入或訪客模式，載入預設或本地資料。', 'info');
        }
    } catch (error) {
        console.error('載入資料錯誤:', error);
        showToast('無法連接伺服器，載入預設資料', 'error');
        loadDefaultData();
    } finally {
        updateAllTags();
        renderItems(items);
        updateTagFilterOptions();
        updateStatistics(); // 更新統計數據
        document.querySelector('.loading').style.display = 'none'; // 隱藏載入中
    }
}

/**
 * 儲存資料到伺服器
 */
async function saveDataToServer() {
    if (!currentUser || currentUser === "訪客") {
        showToast('訪客模式無法儲存到伺服器。', 'warning');
        return;
    }
    if (!isDataChanged) {
        showToast('沒有資料變動需要儲存。', 'info');
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/save`, { // 更改為 /api/save
            method: 'POST', // 更改為 POST
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ // 根據後端需要 username 和 items
                username: currentUser,
                items: items
            })
        });
        const data = await response.json();
        if (data.success) {
            isDataChanged = false; // 儲存成功，清除變動標誌
            showToast('資料已儲存到伺服器', 'success');
        } else {
            showToast(data.message || '儲存失敗', 'error');
        }
    } catch (error) {
        console.error('儲存資料錯誤:', error);
        showToast('無法連接伺服器，儲存失敗', 'error');
    }
}

/**
 * 儲存資料到本地檔案
 */
function saveToLocalFile() {
    if (items.length === 0) {
        showToast('沒有資料可以儲存。', 'warning');
        return;
    }
    const dataStr = JSON.stringify(items, null, 2); // 美化 JSON 輸出
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wishlist_${currentUser || 'guest'}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    isDataChanged = false; // 儲存到本地後清除變動標誌
    showToast('資料已儲存到本地檔案', 'success');
}

/**
 * 載入預設的商品資料
 */
function loadDefaultData() {
    items = [
        {
            id: 1,
            title: "無線藍牙耳機",
            price: 1299,
            url: "https://example.com/product1",
            image: "https://via.placeholder.com/300x300?text=無線耳機",
            purchased: false,
            tags: ["電子產品", "音響"],
            note: "希望是降噪款",
            deadline: "2099-12-31"
        },
        {
            id: 2,
            title: "智慧手錶",
            price: 3599,
            url: "https://example.com/product2",
            image: "https://via.placeholder.com/300x300?text=智慧手錶",
            purchased: true,
            tags: ["電子產品", "穿戴裝置"],
            note: "考慮購買最新款",
            deadline: "2024-06-30"
        },
        {
            id: 3,
            title: "設計師椅子",
            price: 4500,
            url: "https://example.com/product3",
            image: "https://via.placeholder.com/300x300?text=設計椅子",
            purchased: false,
            tags: ["家具", "居家"],
            note: "需等待特價",
            deadline: "2099-12-31"
        },
        {
            id: 4,
            title: "程式設計書籍",
            price: 800,
            url: "https://example.com/product4",
            image: "https://via.placeholder.com/300x300?text=程式設計書",
            purchased: false,
            tags: ["書籍", "學習"],
            note: "關於JavaScript進階",
            deadline: "2024-12-31"
        }
    ];
    isDataSynced = false; // 預設資料未與伺服器同步
    isDataChanged = true; // 預設資料載入後視為有變動
    showToast('已載入預設資料，請登入或儲存到本地。', 'info');
}

// =====================================
// 渲染和更新 UI
// =====================================

/**
 * 渲染商品列表
 * @param {Array} itemsToRender - 要渲染的商品陣列
 */
function renderItems(itemsToRender) {
    const itemList = document.getElementById('itemList');
    const loadingElement = itemList.querySelector('.loading');

    // 清除現有內容，但保留 loading 元素
    Array.from(itemList.children).forEach(child => {
        if (child !== loadingElement) {
            child.remove();
        }
    });

    if (itemsToRender.length === 0) {
        const noItemsDiv = document.createElement('div');
        noItemsDiv.className = 'col s12 center-align';
        noItemsDiv.innerHTML = '<p>目前沒有商品符合條件。</p>';
        itemList.insertBefore(noItemsDiv, loadingElement);
        if (loadingElement) loadingElement.style.display = 'none';
        return;
    }

    itemsToRender.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card horizontal';
        card.setAttribute('data-id', item.id);

        let imageHtml = `
            <div class="card-image">
                <img src="${item.image || 'https://via.placeholder.com/300x300?text=No+Image'}" alt="${item.title}">
            </div>
        `;

        let tagsHtml = '';
        if (item.tags && item.tags.length > 0) {
            item.tags.forEach(tag => {
                tagsHtml += `<div class="chip">${tag}</div>`;
            });
        }

        // 格式化截止日期 (如果存在)
        const displayDeadline = item.deadline ? `<strong>訂購截止:</strong> ${item.deadline}` : '';

        let contentHtml = `
            <div class="card-stacked">
                <div class="card-content">
                    <h5>${item.title}</h5>
                    <p><strong>價格:</strong> $${item.price}</p>
                    <p><strong>購買連結:</strong> <a href="${item.url}" target="_blank">${item.url}</a></p>
                    ${item.note ? `<p><strong>備註:</strong> ${item.note}</p>` : ''}
                    ${displayDeadline ? `<p>${displayDeadline}</p>` : ''}
                    <div class="tags-section">${tagsHtml}</div>
                </div>
                <div class="card-action">
                    <a href="#" class="${item.purchased ? 'green-text' : 'red-text'}">
                        ${item.purchased ? '已購買' : '未購買'}
                    </a>
                    <a href="#" class="edit-item right" data-id="${item.id}" style="margin-right: 15px;">編輯</a>
                    <a href="#" class="toggle-status right" data-id="${item.id}">變更狀態</a>
                    <a href="#" class="delete-item right" data-id="${item.id}" style="margin-right: 15px;">刪除</a>
                </div>
            </div>
        `;

        card.innerHTML = imageHtml + contentHtml;
        itemList.insertBefore(card, loadingElement);
    });

    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

/**
 * 更新所有商品標籤
 */
function updateAllTags() {
    allTags.clear();
    items.forEach(item => {
        if (item.tags) {
            item.tags.forEach(tag => allTags.add(tag));
        }
    });
}

/**
 * 更新標籤篩選選項
 */
function updateTagFilterOptions() {
    const tagFilterSelect = document.getElementById('tagFilter');
    const materializeInstance = M.FormSelect.getInstance(tagFilterSelect);

    // 移除舊的選項
    while (tagFilterSelect.options.length > 1) { // 保留第一個 disabled option
        tagFilterSelect.remove(1);
    }

    // 新增新的選項
    Array.from(allTags).sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagFilterSelect.appendChild(option);
    });

    // 重新初始化 Materialize Select
    if (materializeInstance) {
        materializeInstance.destroy(); // 銷毀舊實例
    }
    M.FormSelect.init(tagFilterSelect); // 重新初始化
}

/**
 * 根據篩選條件過濾商品並重新渲染
 */
function filterItems() {
    const purchasedFilter = document.getElementById('purchasedFilter').value;
    const selectedTags = M.FormSelect.getInstance(
        document.getElementById('tagFilter')
    ).getSelectedValues();

    let filteredItems = items.filter(item => {
        // 購買狀態篩選
        if (purchasedFilter === 'unpurchased' && item.purchased) {
            return false;
        }
        if (purchasedFilter === 'purchased' && !item.purchased) {
            return false;
        }

        // 標籤篩選
        if (selectedTags.length > 0) {
            // 如果商品沒有任何標籤，且篩選器有選中標籤，則不顯示
            if (!item.tags || item.tags.length === 0) {
                return false;
            }
            // 檢查商品是否有任何一個選中的標籤
            const hasMatchingTag = selectedTags.some(tag => item.tags.includes(tag));
            if (!hasMatchingTag) {
                return false;
            }
        }
        return true;
    });

    renderItems(filteredItems);
    updateStatistics(); // 更新統計數據
}

/**
 * 更新統計數據顯示
 */
function updateStatistics() {
    const purchasedFilter = document.getElementById('purchasedFilter').value;
    const selectedTags = M.FormSelect.getInstance(
        document.getElementById('tagFilter')
    ).getSelectedValues();

    let filteredItems = items.filter(item => {
        if (purchasedFilter === 'all') return true;
        return purchasedFilter === 'purchased' ? item.purchased : !item.purchased;
    });

    if (selectedTags.length > 0) {
        filteredItems = filteredItems.filter(item => {
            if (!item.tags || item.tags.length === 0) return false;
            return selectedTags.some(tag => item.tags.includes(tag));
        });
    }

    const totalItemsCount = filteredItems.length;
    const unpurchasedItemsCount = filteredItems.filter(item => !item.purchased).length;
    const purchasedItemsCount = filteredItems.filter(item => item.purchased).length;

    // 計算目前篩選條件下未購買商品的總金額
    const filteredTotalAmount = filteredItems
        .filter(item => !item.purchased)
        .reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

    // 計算所有未購買商品的總金額
    const overallUnpurchasedAmount = items
        .filter(item => !item.purchased)
        .reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

    document.getElementById('totalItemsCount').textContent = totalItemsCount;
    document.getElementById('unpurchasedItemsCount').textContent = unpurchasedItemsCount;
    document.getElementById('purchasedItemsCount').textContent = purchasedItemsCount;
    document.getElementById('filteredTotalAmount').textContent = filteredTotalAmount.toFixed(2); // 顯示兩位小數
    document.getElementById('overallUnpurchasedAmount').textContent = overallUnpurchasedAmount.toFixed(2);
}

// =====================================
// CRUD 操作
// =====================================

/**
 * 新增商品
 * @param {string} title
 * @param {number} price
 * @param {string} url
 * @param {boolean} purchased
 * @param {string} image - Base64 圖片或 URL
 * @param {string} note
 * @param {string[]} tags
 * @param {string} deadline
 */
async function addItem(title, price, url, purchased, image, note, tags, deadline) {
    // 簡單驗證
    if (!title || !price || !url) {
        showToast('商品名稱、價格和連結是必填欄位。', 'error');
        return;
    }

    const newItem = {
        id: items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1,
        title,
        price: parseFloat(price),
        url,
        image,
        purchased,
        note,
        tags,
        deadline // 新增截止日期
    };

    items.push(newItem);
    isDataChanged = true; // 資料已變動
    updateAllTags();
    updateTagFilterOptions();
    filterItems(); // 重新篩選並渲染
    M.Modal.getInstance(document.getElementById('addItemModal')).close();
    showToast('商品已新增', 'success');
}

/**
 * 開啟編輯模態框並載入商品數據
 * @param {number} id - 商品 ID
 */
function openEditModal(id) {
    const item = items.find(item => item.id === id);
    if (!item) return;

    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemTitle').value = item.title;
    document.getElementById('editItemPrice').value = item.price;
    document.getElementById('editItemUrl').value = item.url;
    document.getElementById('editItemNote').value = item.note || '';
    document.getElementById('editPurchasedSwitch').checked = item.purchased;

    // 設定編輯模態框的截止日期
    const editDeadlineInput = document.getElementById('editItemDeadline');
    const deadlineValue = item.deadline || '2099-12-31';
    editDeadlineInput.value = deadlineValue;

    const datepickerInstance = M.Datepicker.getInstance(editDeadlineInput);
    if (datepickerInstance) {
        const dateParts = deadlineValue.split('-');
        if (dateParts.length === 3) {
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // 月份從 0 開始
            const day = parseInt(dateParts[2]);
            const dateObj = new Date(year, month, day);
            if (!isNaN(dateObj.getTime())) {
                datepickerInstance.setDate(dateObj);
                datepickerInstance.gotoDate(dateObj);
            } else {
                datepickerInstance.setDate(new Date(2099, 11, 31));
                datepickerInstance.gotoDate(new Date(2099, 11, 31));
            }
        } else {
            datepickerInstance.setDate(new Date(2099, 11, 31));
            datepickerInstance.gotoDate(new Date(2099, 11, 31));
        }
    }


    // 處理圖片預覽
    const editImagePreview = document.getElementById('editImagePreview');
    const editPreviewImage = document.getElementById('editPreviewImage');
    const editImageUrlInput = document.getElementById('editImageUrl');
    if (item.image) {
        editPreviewImage.src = item.image;
        editImagePreview.style.display = 'block';
        if (item.image.startsWith('http')) { // 如果是 URL
            editImageUrlInput.value = item.image;
            document.getElementById('editImageUpload').value = ''; // 清空檔案輸入
        } else { // 如果是 Base64
            editImageUrlInput.value = '';
            // 對於 Base64 圖片，無法預設設定檔案輸入，只能顯示預覽
        }
    } else {
        editImagePreview.style.display = 'none';
        editPreviewImage.src = '';
        editImageUrlInput.value = '';
        document.getElementById('editImageUpload').value = '';
    }

    // 初始化編輯標籤 Chips
    const editTagChipsElement = document.getElementById('editTagChips');
    M.Chips.init(editTagChipsElement, {
        data: (item.tags || []).map(tag => ({ tag: tag })),
        placeholder: '新增標籤',
        secondaryPlaceholder: '+標籤',
        onAdd: () => { isDataChanged = true; updateAllTags(); },
        onDelete: () => { isDataChanged = true; updateAllTags(); }
    });

    M.updateTextFields(); // 確保標籤縮小

    M.Modal.getInstance(document.getElementById('editItemModal')).open();
}

/**
 * 更新商品
 */
async function updateItem() {
    const id = parseInt(document.getElementById('editItemId').value);
    const item = items.find(item => item.id === id);
    if (!item) return;

    const newTitle = document.getElementById('editItemTitle').value.trim();
    const newPrice = parseFloat(document.getElementById('editItemPrice').value);
    const newUrl = document.getElementById('editItemUrl').value.trim();
    const newNote = document.getElementById('editItemNote').value.trim();
    const newPurchased = document.getElementById('editPurchasedSwitch').checked;
    const newDeadline = document.getElementById('editItemDeadline').value || '2099-12-31'; // 獲取新截止日期

    const newImageFile = document.getElementById('editImageUpload').files[0];
    const newImageUrl = document.getElementById('editImageUrl').value.trim();

    if (!newTitle || !newPrice || !newUrl) {
        showToast('商品名稱、價格和連結是必填欄位。', 'error');
        return;
    }

    // 處理新圖片
    let finalImage = item.image; // 預設使用舊圖片
    if (newImageFile) {
        finalImage = await getImageData(newImageFile, ''); // 優先處理上傳的檔案
    } else if (newImageUrl) {
        finalImage = newImageUrl; // 其次處理新的圖片 URL
    } else if (!item.image && !newImageFile && !newImageUrl) {
        finalImage = ''; // 如果沒有舊圖片，也沒有新圖片，則清空
    }


    const tagChips = M.Chips.getInstance(document.getElementById('editTagChips'));
    const newTags = tagChips.chipsData.map(chip => chip.tag);

    // 檢查是否有實際變動
    const hasChanges = item.title !== newTitle ||
                       item.price !== newPrice ||
                       item.url !== newUrl ||
                       item.note !== newNote ||
                       item.purchased !== newPurchased ||
                       item.image !== finalImage ||
                       JSON.stringify(item.tags) !== JSON.stringify(newTags) ||
                       item.deadline !== newDeadline; // 檢查截止日期變動

    if (hasChanges) {
        item.title = newTitle;
        item.price = newPrice;
        item.url = newUrl;
        item.note = newNote;
        item.purchased = newPurchased;
        item.image = finalImage;
        item.tags = newTags;
        item.deadline = newDeadline; // 更新截止日期

        isDataChanged = true; // 資料已變動
        updateAllTags();
        updateTagFilterOptions();
        filterItems(); // 重新篩選並渲染
        showToast('商品已更新', 'success');
    } else {
        showToast('沒有任何變動', 'info');
    }

    M.Modal.getInstance(document.getElementById('editItemModal')).close();
}

/**
 * 切換商品的購買狀態
 * @param {number} id - 商品 ID
 */
function togglePurchased(id) {
    const item = items.find(item => item.id === id);
    if (item) {
        item.purchased = !item.purchased;
        isDataChanged = true; // 資料已變動
        filterItems(); // 重新篩選並渲染
        showToast(`商品狀態已變更為: ${item.purchased ? '已購買' : '未購買'}`, 'info');
    }
}

/**
 * 刪除商品
 * @param {number} id - 商品 ID
 */
function deleteItem(id) {
    items = items.filter(item => item.id !== id);
    isDataChanged = true; // 資料已變動
    updateAllTags();
    updateTagFilterOptions();
    filterItems(); // 重新篩選並渲染
    showToast('商品已刪除', 'success');
}

// =====================================
// 登入/註冊邏輯
// =====================================

/**
 * 處理登入或註冊
 * @param {boolean} isRegister - 是否為註冊操作 (此後端 API 中，login 已經包含了註冊功能)
 */
async function loginOrRegister(isRegister = false) { // isRegister 參數在此處會被忽略，因為後端 /api/login 同時處理
    const username = document.getElementById('username').value.trim();

    if (!username) {
        showToast('請輸入使用者名稱', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, { // 統一呼叫 /api/login
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
        const data = await response.json();

        if (data.success) {
            currentUser = username;
            items = data.data || []; // 從後端獲取資料
            isDataSynced = true;
            isDataChanged = false; // 初始狀態未更改

            // 更新UI
            document.getElementById('currentUser').textContent = `使用者: ${username}`;
            document.getElementById('logoutBtn').style.display = 'inline-block';
            document.getElementById('saveToServerBtn').style.display = 'inline-block';
            document.getElementById('saveToLocalBtn').style.display = 'inline-block'; // 登入後也可以儲存到本地

            M.Modal.getInstance(document.getElementById('loginModal')).close();
            showToast(`成功${data.isNewUser ? '註冊並' : ''}登入為 ${username}`, 'success'); // 根據 isNewUser 判斷
            // 無需額外 loadData()，因為數據已經在登入時獲取
            updateAllTags();
            renderItems(items);
            updateTagFilterOptions();
            updateStatistics();
        } else {
            showToast(data.message || '操作失敗', 'error');
        }
    } catch (error) {
        console.error('錯誤:', error);
        showToast('無法連接伺服器，自動進入訪客模式', 'error');
        // 如果無法連接伺服器，自動進入訪客模式
        currentUser = "訪客";
        items = []; // 清空可能載入的舊數據
        isDataSynced = false;
        isDataChanged = true; // 視為有變動，提示儲存到本地
        document.getElementById('currentUser').textContent = `使用者: 訪客 (離線)`;
        document.getElementById('logoutBtn').style.display = 'inline-block';
        document.getElementById('saveToServerBtn').style.display = 'none'; // 訪客模式不能儲存到伺服器
        document.getElementById('saveToLocalBtn').style.display = 'inline-block';
        loadDefaultData(); // 載入預設資料
        M.Modal.getInstance(document.getElementById('loginModal')).close();
        showToast('無法連接伺服器，已進入訪客模式。', 'warning');
    }
}

/**
 * 登出功能
 */
function logout() {
    if (isDataChanged && currentUser !== "訪客") {
        if (!confirm('您有未儲存的資料變更，確定要登出嗎？未儲存的變更將會遺失。')) {
            return;
        }
    }

    currentUser = null;
    items = [];
    isDataSynced = false;
    isDataChanged = false;

    // 更新UI
    document.getElementById('currentUser').textContent = '未登入';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('saveToServerBtn').style.display = 'none';
    document.getElementById('saveToLocalBtn').style.display = 'none';
    renderItems([]); // 清空商品列表
    updateStatistics(); // 更新統計數據為 0
    showToast('已登出', 'info');
    M.Modal.getInstance(document.getElementById('loginModal')).open(); // 重新打開登入模態框
}

// =====================================
// 初始化和事件監聽器
// =====================================

document.addEventListener('DOMContentLoaded', function() {
    // 初始化 Materialize 元件
    M.AutoInit(); // 初始化所有 Materialize JS 元件 (Modal, Select, Datepicker etc.)

    // 手動初始化 Datepicker
    M.Datepicker.init(document.querySelectorAll('.datepicker'), {
        format: 'yyyy-mm-dd',
        autoClose: true,
        setDefaultDate: true,
        defaultDate: new Date(2099, 11, 31), // 預設為 2099-12-31
        i18n: {
            cancel: '取消',
            clear: '清除',
            done: '確定',
            months: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
            monthsShort: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'],
            weekdays: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
            weekdaysShort: ['日', '一', '二', '三', '四', '五', '六'],
            weekdaysAbbrev: ['日', '一', '二', '三', '四', '五', '六']
        },
        onSelect: () => { // 當選擇日期時，確保標籤浮動
            M.updateTextFields();
        }
    });

    // 登入模態框預設打開
    M.Modal.getInstance(document.getElementById('loginModal')).open();

    // 綁定登入/註冊按鈕事件
    document.getElementById('loginBtn').addEventListener('click', () => loginOrRegister(false)); // 這裡的 isRegister 參數對此後端無實際作用
    document.getElementById('registerBtn').addEventListener('click', () => loginOrRegister(true)); // 同上
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // 訪客模式按鈕事件
    document.getElementById('guestModeBtn').addEventListener('click', function() {
        document.getElementById('localFileUpload').click(); // 觸發檔案選擇
    });

    // 本地檔案上傳處理
    document.getElementById('localFileUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const data = JSON.parse(event.target.result);
                    // 簡單驗證資料結構，確保是陣列且包含 id 和 title 屬性
                    if (Array.isArray(data) && data.every(item => typeof item.id === 'number' && typeof item.title === 'string')) {
                        items = data;
                        currentUser = "訪客"; // 設定訪客用戶名
                        isDataSynced = true; // 假裝同步，因為是從本地讀取
                        isDataChanged = false; // 初始狀態未更改

                        document.getElementById('currentUser').textContent = `使用者: 訪客 (本地模式)`;
                        document.getElementById('logoutBtn').style.display = 'inline-block';
                        document.getElementById('saveToServerBtn').style.display = 'none'; // 訪客模式不能儲存到伺服器
                        document.getElementById('saveToLocalBtn').style.display = 'inline-block'; // 訪客模式可以儲存到本地

                        M.Modal.getInstance(document.getElementById('loginModal')).close();
                        updateAllTags();
                        renderItems(items);
                        updateTagFilterOptions();
                        updateStatistics(); // 更新統計數據
                        showToast('已從本地檔案載入資料 (訪客模式)', 'success');
                    } else {
                        showToast('載入的 JSON 檔案格式不正確，請選擇有效的願望清單檔案。', 'error');
                    }
                } catch (error) {
                    console.error('解析 JSON 錯誤:', error);
                    showToast('載入的檔案不是有效的 JSON 格式。', 'error');
                }
            };
            reader.readAsText(file);
        }
    });

    // 儲存到伺服器/本地按鈕事件
    document.getElementById('saveToServerBtn').addEventListener('click', saveDataToServer);
    document.getElementById('saveToLocalBtn').addEventListener('click', saveToLocalFile);


    // 新增商品表單提交
    document.getElementById('saveItem').addEventListener('click', async function() {
        const title = document.getElementById('itemTitle').value.trim();
        const price = document.getElementById('itemPrice').value;
        const url = document.getElementById('itemUrl').value.trim();
        const note = document.getElementById('itemNote').value.trim();
        const purchased = document.getElementById('purchasedSwitch').checked;
        const deadline = document.getElementById('itemDeadline').value || '2099-12-31'; // 從 Datepicker 獲取日期

        const imageFile = document.getElementById('imageUpload').files[0];
        const imageUrl = document.getElementById('imageUrl').value.trim();

        const tagChips = M.Chips.getInstance(document.getElementById('tagChips'));
        const tags = tagChips.chipsData.map(chip => chip.tag);

        let finalImage = '';
        try {
            finalImage = await getImageData(imageFile, imageUrl);
        } catch (error) {
            showToast('圖片處理失敗: ' + error.message, 'error');
            return;
        }

        await addItem(title, price, url, purchased, finalImage, note, tags, deadline);
        resetForm(); // 重置表單
    });

    // 更新商品表單提交
    document.getElementById('updateItem').addEventListener('click', updateItem);

    // 圖片上傳按鈕和預覽邏輯 (新增商品)
    document.getElementById('uploadImageBtn').addEventListener('click', () => {
        document.getElementById('imageUpload').click();
    });
    document.getElementById('imageUpload').addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('previewImage').src = e.target.result;
                document.getElementById('imagePreview').style.display = 'block';
                document.getElementById('imageUrl').value = ''; // 清空 URL 輸入
                M.updateTextFields(); // 確保標籤縮小
            };
            reader.readAsDataURL(file);
        } else {
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('previewImage').src = '';
        }
    });
    document.getElementById('imageUrl').addEventListener('input', function() {
        if (this.value) {
            document.getElementById('previewImage').src = this.value;
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('imageUpload').value = ''; // 清空檔案輸入
        } else {
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('previewImage').src = '';
        }
    });

    // 圖片上傳按鈕和預覽邏輯 (編輯商品)
    document.getElementById('editUploadImageBtn').addEventListener('click', () => {
        document.getElementById('editImageUpload').click();
    });
    document.getElementById('editImageUpload').addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('editPreviewImage').src = e.target.result;
                document.getElementById('editImagePreview').style.display = 'block';
                document.getElementById('editImageUrl').value = ''; // 清空 URL 輸入
                M.updateTextFields(); // 確保標籤縮小
            };
            reader.readAsDataURL(file);
        } else {
            document.getElementById('editImagePreview').style.display = 'none';
            document.getElementById('editPreviewImage').src = '';
        }
    });
    document.getElementById('editImageUrl').addEventListener('input', function() {
        if (this.value) {
            document.getElementById('editPreviewImage').src = this.value;
            document.getElementById('editImagePreview').style.display = 'block';
            document.getElementById('editImageUpload').value = ''; // 清空檔案輸入
        } else {
            document.getElementById('editImagePreview').style.display = 'none';
            document.getElementById('editPreviewImage').src = '';
        }
    });


    // 初始化新增商品標籤 Chips
    M.Chips.init(document.getElementById('tagChips'), {
        placeholder: '新增標籤',
        secondaryPlaceholder: '+標籤',
        onAdd: () => { isDataChanged = true; updateAllTags(); },
        onDelete: () => { isDataChanged = true; updateAllTags(); }
    });

    // 篩選條件變更事件
    document.getElementById('purchasedFilter').addEventListener('change', filterItems);
    document.getElementById('tagFilter').addEventListener('change', filterItems);

    // 重設篩選按鈕
    document.getElementById('resetFilters').addEventListener('click', function() {
        M.FormSelect.getInstance(document.getElementById('purchasedFilter')).set('all');
        const tagSelectInstance = M.FormSelect.getInstance(document.getElementById('tagFilter'));
        if (tagSelectInstance) {
            tagSelectInstance.destroy(); // 銷毀實例以便重設
            M.FormSelect.init(document.getElementById('tagFilter')); // 重新初始化
        }
        filterItems(); // 重新渲染
        showToast('篩選條件已重設', 'info');
    });


    // 委派事件監聽器給動態生成的商品卡片
    document.getElementById('itemList').addEventListener('click', function(e) {
        // 編輯按鈕
        if (e.target.classList.contains('edit-item')) {
            e.preventDefault();
            const id = parseInt(e.target.dataset.id);
            openEditModal(id);
        }
        // 變更狀態按鈕
        if (e.target.classList.contains('toggle-status')) {
            e.preventDefault();
            const id = parseInt(e.target.dataset.id);
            togglePurchased(id);
        }
        // 刪除按鈕
        if (e.target.classList.contains('delete-item')) {
            e.preventDefault();
            const id = parseInt(e.target.dataset.id);
            if (confirm('確定要刪除這個商品嗎？')) {
                deleteItem(id);
            }
        }
    });

    // 監聽模態框關閉事件，重置編輯表單
    const editItemModalInstance = M.Modal.getInstance(document.getElementById('editItemModal'));
    editItemModalInstance.options.onCloseEnd = resetEditForm;

    const addItemModalInstance = M.Modal.getInstance(document.getElementById('addItemModal'));
    addItemModalInstance.options.onCloseEnd = resetForm;
});