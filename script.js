        // 商品資料
        let items = [];
        let allTags = [];
        let currentUser = null;
        let isDataSynced = false;
        let isDataChanged = false;
        let serverUrl = "https://subtle-lan-owners-cardiac.trycloudflare.com"
        
        // 初始化元件
        document.addEventListener('DOMContentLoaded', function() {
            // 初始化模態框
            M.Modal.init(document.querySelectorAll('.modal'));
            
            // 初始化登入模態框
            const loginModal = M.Modal.init(document.getElementById('loginModal'), {dismissible: false});
            loginModal.open(); // 一開始就開啟登入模態框

            // 初始化選擇框
            M.FormSelect.init(document.querySelectorAll('select'));
            
            // 初始化標籤 chips (新增商品)
            M.Chips.init(document.getElementById('tagChips'), {
                placeholder: '新增標籤',
                secondaryPlaceholder: '+標籤'
            });

            // 初始化標籤 chips (編輯商品)
            M.Chips.init(document.getElementById('editTagChips'), {
                placeholder: '新增標籤',
                secondaryPlaceholder: '+標籤'
            });
            
            // 圖片上傳按鈕事件 (新增商品)
            document.getElementById('uploadImageBtn').addEventListener('click', function() {
                document.getElementById('imageUpload').click();
            });
            
            document.getElementById('imageUpload').addEventListener('change', function(e) {
                if (e.target.files.length > 0) {
                    var reader = new FileReader();
                    reader.onload = function(event) {
                        document.getElementById('previewImage').src = event.target.result;
                        document.getElementById('imagePreview').style.display = 'block';
                    };
                    reader.readAsDataURL(e.target.files[0]);
                }
            });
            
            document.getElementById('imageUrl').addEventListener('change', function() {
                if (this.value) {
                    document.getElementById('previewImage').src = this.value;
                    document.getElementById('imagePreview').style.display = 'block';
                }
            });

            // 圖片上傳按鈕事件 (編輯商品)
            document.getElementById('editUploadImageBtn').addEventListener('click', function() {
                document.getElementById('editImageUpload').click();
            });
            
            document.getElementById('editImageUpload').addEventListener('change', function(e) {
                if (e.target.files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        document.getElementById('editPreviewImage').src = event.target.result;
                        document.getElementById('editImagePreview').style.display = 'block';
                    };
                    reader.readAsDataURL(e.target.files[0]);
                }
            });
            
            document.getElementById('editImageUrl').addEventListener('change', function() {
                if (this.value) {
                    document.getElementById('editPreviewImage').src = this.value;
                    document.getElementById('editImagePreview').style.display = 'block';
                }
            });
            
            // 儲存商品事件
            document.getElementById('saveItem').addEventListener('click', saveItem);
            
            // 篩選事件
            document.getElementById('purchasedFilter').addEventListener('change', filterItems);
            document.getElementById('tagFilter').addEventListener('change', filterItems);
            document.getElementById('resetFilters').addEventListener('click', function() {
                // 重設購買狀態
                document.getElementById('purchasedFilter').value = 'all';

                // 銷毀舊實例，這樣 Materialize 就能清掉舊的 UI 元素
                const purchasedFilterInstance = M.FormSelect.getInstance(purchasedFilter);
                if (purchasedFilterInstance) {
                    purchasedFilterInstance.destroy();
                }
                // 重新初始化 FormSelect，讓它根據當前原生 <select> 的值來重建 UI
                M.FormSelect.init(purchasedFilter); // 不需要額外選項，因為是單選
                
                // 完全重設標籤選擇器
                const tagFilter = document.getElementById('tagFilter');
                const instance = M.FormSelect.getInstance(tagFilter);
                
                // 清除所有選項的 selected 狀態
                Array.from(tagFilter.options).forEach(option => {
                    option.selected = false;
                });
                instance.input.value = '選擇標籤';
                
                // 清除視覺選中狀態
                const dropdown = instance.dropdownOptions;
                dropdown.querySelectorAll('li.selected').forEach(li => {
                    li.classList.remove('selected');
                    li.querySelector('input').checked = false;
                });
                
                // 重新初始化
                M.FormSelect.init(tagFilter);
                filterItems(); // 觸發篩選
            });
            
            // 事件委派處理變更狀態、刪除和編輯
            document.getElementById('itemList').addEventListener('click', function(e) {
                // 變更狀態按鈕
                if (e.target.classList.contains('toggle-status')) {
                    e.preventDefault();
                    const id = parseInt(e.target.getAttribute('data-id'));
                    togglePurchased(id);
                }
                
                // 刪除按鈕
                if (e.target.classList.contains('delete-item')) {
                    e.preventDefault();
                    const id = parseInt(e.target.getAttribute('data-id'));
                    deleteItem(id);
                }

                // 編輯按鈕
                if (e.target.classList.contains('edit-item')) {
                    e.preventDefault();
                    const id = parseInt(e.target.getAttribute('data-id'));
                    openEditModal(id);
                }
            });
            
            // 登入按鈕事件
            document.getElementById('loginBtn').addEventListener('click', () => loginOrRegister(false));
            
            // 註冊按鈕事件
            document.getElementById('registerBtn').addEventListener('click', () => loginOrRegister(true));
            
            // 登出按鈕事件
            document.getElementById('logoutBtn').addEventListener('click', logout);
            
            // 儲存到伺服器按鈕事件
            document.getElementById('saveToServerBtn').addEventListener('click', saveToServer);

            // 儲存到本地按鈕事件
            document.getElementById('saveToLocalBtn').addEventListener('click', saveToLocal);
            
            // 監聽頁面關閉事件
            window.addEventListener('beforeunload', function(e) {
                if (currentUser && isDataChanged && !isDataSynced) {
                    e.preventDefault();
                    e.returnValue = '您有未儲存的變更，確定要離開嗎？';
                    return e.returnValue;
                }
            });
        });
        
        // 顯示通知
        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = `toast ${type} show`;
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
        
        // 載入資料 (現在只在登入成功後呼叫)
        async function loadData() {
            // 這個函數現在只會透過伺服器載入資料，本地 data.json 已不再使用
            // 伺服器端會處理資料載入
            updateAllTags();
            renderItems(items);
            updateTagFilterOptions();

            M.FormSelect.init(document.getElementById('tagFilter'), {
                dropdownOptions: {
                    closeOnClick: false // 允許多選
                }
            });
        }
        
        // 載入預設資料 (這個函數將不再從 loadData 中呼叫，僅供後備參考)
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
                    note: ""
                },
                {
                    id: 2,
                    title: "智慧手錶",
                    price: 3599,
                    url: "https://example.com/product2",
                    image: "https://via.placeholder.com/300x300?text=智慧手錶",
                    purchased: true,
                    tags: ["電子產品", "穿戴裝置"],
                    note: "考慮購買最新款"
                },
                {
                    id: 3,
                    title: "設計師椅子",
                    price: 4500,
                    url: "https://example.com/product3",
                    image: "https://via.placeholder.com/300x300?text=設計椅子",
                    purchased: false,
                    tags: ["家具", "居家"],
                    note: "需等待特價"
                }
            ];
        }
        
        // 更新所有標籤
        function updateAllTags() {
            allTags = [];
            items.forEach(item => {
                if (item.tags && item.tags.length > 0) {
                    item.tags.forEach(tag => {
                        if (!allTags.includes(tag)) {
                            allTags.push(tag);
                        }
                    });
                }
            });
        }
        
        // 更新標籤篩選選項
        function updateTagFilterOptions() {
            const tagFilter = document.getElementById('tagFilter');
            // Store current selected values to re-select after updating options
            const currentSelectedTags = M.FormSelect.getInstance(tagFilter) ? M.FormSelect.getInstance(tagFilter).getSelectedValues() : [];
            
            tagFilter.innerHTML = '<option value="" disabled>選擇標籤</option>'; // Removed selected from disabled option
            
            allTags.sort().forEach(tag => { // Sort tags alphabetically
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                if (currentSelectedTags.includes(tag)) { // Re-select previously selected tags
                    option.selected = true;
                }
                tagFilter.appendChild(option);
            });
            
            M.FormSelect.init(tagFilter);
        }
        
        // 渲染商品列表
        function renderItems(itemsToRender) {
            const itemList = document.getElementById('itemList');
            const loadingElement = itemList.querySelector('.loading');
            
            // 清除現有內容，但保留 loading 元素
            Array.from(itemList.children).forEach(child => {
                if (child !== loadingElement) {
                    itemList.removeChild(child);
                }
            });
            
            if (itemsToRender.length === 0) {
                // 如果沒有商品，並且不是正在加載，顯示提示
                if (!loadingElement || loadingElement.style.display === 'none') {
                    itemList.innerHTML += '<p class="center-align">沒有符合條件的商品</p>';
                }
                return;
            }
            
            itemsToRender.forEach(item => {
                const card = document.createElement('div');
                card.className = 'card horizontal';
                card.setAttribute('data-id', item.id);
                
                // 圖片部分
                let imageHtml = `
                    <div class="card-image">
                        <img src="${item.image || 'https://via.placeholder.com/300x300?text=No+Image'}" alt="${item.title}">
                    </div>
                `;
                
                // 內容部分
                let tagsHtml = '';
                if (item.tags && item.tags.length > 0) {
                    item.tags.forEach(tag => {
                        tagsHtml += `<div class="chip">${tag}</div>`;
                    });
                }
                
                let contentHtml = `
                    <div class="card-stacked">
                        <div class="card-content">
                            <h5>${item.title}</h5>
                            <p><strong>價格:</strong> $${item.price}</p>
                            <p><strong>購買連結:</strong> <a href="${item.url}" target="_blank">${item.url}</a></p>
                            ${item.note ? `<p><strong>備註:</strong> ${item.note}</p>` : ''}
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
                
                // 插入到 loading 元素之前
                itemList.insertBefore(card, loadingElement);
            });
            
            // 隱藏加載動畫
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }
        
        // 儲存商品
        function saveItem() {
            const title = document.getElementById('itemTitle').value.trim();
            const price = document.getElementById('itemPrice').value.trim();
            const url = document.getElementById('itemUrl').value.trim();
            const note = document.getElementById('itemNote').value.trim(); // Get note value
            
            // 簡單驗證
            if (!title || !price || !url) {
                showToast('請填寫所有必填欄位', 'error');
                return;
            }
            
            const purchased = document.getElementById('purchasedSwitch').checked;
            
            // 獲取圖片 (優先使用上傳的圖片)
            let image = document.getElementById('imageUrl').value.trim();
            const uploadedFile = document.getElementById('imageUpload').files[0];
            
            if (uploadedFile) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    image = e.target.result;
                    saveItemWithImage(title, price, url, purchased, image, note);
                };
                reader.readAsDataURL(uploadedFile);
            } else if (image) {
                saveItemWithImage(title, price, url, purchased, image, note);
            } else {
                saveItemWithImage(title, price, url, purchased, '', note);
            }
        }
        
        function saveItemWithImage(title, price, url, purchased, image, note) {
            // 獲取標籤
            const tagChips = M.Chips.getInstance(document.getElementById('tagChips'));
            const tags = tagChips.chipsData.map(chip => chip.tag);
            
            // 創建新商品
            const newItem = {
                id: items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1,
                title,
                price: parseFloat(price),
                url,
                image,
                purchased,
                note, // Add note to the new item
                tags
            };
            
            // 添加到商品列表
            items.push(newItem);
            
            // 更新標籤列表
            updateAllTags();
            updateTagFilterOptions();
            
            // 重新渲染商品列表
            renderItems(items);
            
            // 關閉模態框並重置表單
            const modalInstance = M.Modal.getInstance(document.getElementById('addItemModal'));
            modalInstance.close();
            resetForm();
            
            showToast('商品已新增');

            isDataChanged = true;
            isDataSynced = false;
        }
        
        // 重置表單
        function resetForm() {
            document.getElementById('itemTitle').value = '';
            document.getElementById('itemPrice').value = '';
            document.getElementById('itemUrl').value = '';
            document.getElementById('itemNote').value = ''; // Reset note field
            document.getElementById('imageUrl').value = '';
            document.getElementById('imageUpload').value = '';
            document.getElementById('previewImage').src = '';
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('purchasedSwitch').checked = false;
            
            // 清除標籤 chips
            const chips = M.Chips.getInstance(document.getElementById('tagChips'));
            // 這裡使用 for 迴圈來避免在迭代過程中修改陣列的問題
            while (chips.chipsData.length > 0) {
                chips.deleteChip(0);
            }
        }
        
        // 篩選商品
        function filterItems() {
            const purchasedFilter = document.getElementById('purchasedFilter').value;
            const selectedTags = M.FormSelect.getInstance(
                document.getElementById('tagFilter')
            ).getSelectedValues();

            // 購買狀態篩選
            let filteredItems = items.filter(item => {
                if (purchasedFilter === 'all') return true;
                return purchasedFilter === 'purchased' ? item.purchased : !item.purchased;
            });

            // 標籤篩選 (只有當有選擇標籤時才篩選)
            if (selectedTags.length > 0) {
                filteredItems = filteredItems.filter(item => {
                    // 沒有標籤的商品不顯示
                    if (!item.tags || item.tags.length === 0) return false;
                    // 需包含任一選擇的標籤
                    return selectedTags.some(tag => item.tags.includes(tag));
                });
            }

            renderItems(filteredItems);
        }

        
        // 切換購買狀態
        function togglePurchased(id) {
            const item = items.find(item => item.id === id);
            if (item) {
                item.purchased = !item.purchased;
                renderItems(items);
                showToast('狀態已更新');
                isDataChanged = true;
                isDataSynced = false;
            }
        }
        
        // 刪除商品
        function deleteItem(id) {
            if (confirm('確定要刪除此商品嗎？')) {
                items = items.filter(item => item.id !== id);
                updateAllTags();
                updateTagFilterOptions();
                renderItems(items);
                showToast('商品已刪除');
                isDataChanged = true;
                isDataSynced = false;
            }
        }

        // 登入/註冊函數 (現在合併為同一個功能)
        async function loginOrRegister(isRegister = false) {
            const username = document.getElementById('username').value.trim();
            
            if (!username) {
                showToast('請輸入使用者名稱', 'error');
                return;
            }
            
            try {
                const response = await fetch(serverUrl+'/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({username})
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentUser = username;
                    isDataSynced = true;
                    isDataChanged = false;
                    
                    // 更新UI
                    document.getElementById('currentUser').textContent = `使用者: ${username}`;
                    document.getElementById('logoutBtn').style.display = 'inline-block';
                    document.getElementById('saveToServerBtn').style.display = 'inline-block';
                    document.getElementById('saveToLocalBtn').style.display = 'inline-block'; // Show Save to Local button
                    
                    // 關閉登入模態框
                    M.Modal.getInstance(document.getElementById('loginModal')).close();
                    
                    // 如果是新用戶或註冊動作
                    if (data.isNewUser || isRegister) {
                        showToast(`歡迎新用戶 ${username}!`);
                        // 清空現有資料
                        items = [];
                        updateAllTags();
                        renderItems(items);
                        updateTagFilterOptions();
                    } else if (data.data && data.data.length > 0) {
                        // 載入伺服器資料
                        items = data.data;
                        updateAllTags();
                        renderItems(items);
                        updateTagFilterOptions();
                        showToast(`歡迎回來 ${username}!`);
                    } else {
                        showToast(`歡迎 ${username}!`);
                        // 如果沒有伺服器資料，則顯示預設資料
                        loadDefaultData(); // 保留此行以在沒有資料時提供初始內容
                        updateAllTags();
                        renderItems(items);
                        updateTagFilterOptions();
                    }
                } else {
                    showToast(data.message || '操作失敗', 'error');
                }
            } catch (error) {
                console.error('錯誤:', error);
                showToast('無法連接伺服器', 'error');
            }
        }

        // 登出函數保持不變
        function logout() {
            currentUser = null;
            isDataSynced = false;
            isDataChanged = false;
            
            document.getElementById('currentUser').textContent = '未登入';
            document.getElementById('logoutBtn').style.display = 'none';
            document.getElementById('saveToServerBtn').style.display = 'none';
            document.getElementById('saveToLocalBtn').style.display = 'none'; // Hide Save to Local button
            
            // 清空商品列表
            items = [];
            renderItems(items);
            updateAllTags();
            updateTagFilterOptions();

            M.Modal.getInstance(document.getElementById('loginModal')).open();
            
            showToast('已登出');
        }

        // 儲存到伺服器函數保持不變
        async function saveToServer() {
            if (!currentUser) {
                showToast('請先登入', 'error');
                return;
            }
            
            try {
                const response = await fetch(serverUrl+'/api/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: currentUser,
                        items: items
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    isDataSynced = true;
                    isDataChanged = false;
                    showToast('已儲存到伺服器');
                } else {
                    showToast(data.message || '儲存失敗', 'error');
                }
            } catch (error) {
                console.error('儲存錯誤:', error);
                showToast('無法連接伺服器', 'error');
            }
        }

        // 儲存到本地
        function saveToLocal() {
            const dataStr = JSON.stringify(items, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = currentUser ? `${currentUser}_wantlist.json` : 'wantlist.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            showToast('已儲存到本地檔案');
        }

        // 打開編輯模態框
        function openEditModal(id) {
            const item = items.find(item => item.id === id);
            if (!item) return;
            
            document.getElementById('editItemId').value = id;
            document.getElementById('editItemTitle').value = item.title;
            document.getElementById('editItemPrice').value = item.price;
            document.getElementById('editItemUrl').value = item.url;
            document.getElementById('editItemNote').value = item.note || '';
            document.getElementById('editPurchasedSwitch').checked = item.purchased;
            
            // 圖片處理
            if (item.image) {
                document.getElementById('editPreviewImage').src = item.image;
                document.getElementById('editImagePreview').style.display = 'block';
                document.getElementById('editImageUrl').value = item.image.startsWith('data:') ? '' : item.image;
            } else {
                document.getElementById('editImagePreview').style.display = 'none';
                document.getElementById('editImageUrl').value = '';
            }
            
            // 標籤處理
            const editTagChips = M.Chips.getInstance(document.getElementById('editTagChips'));
            // Clear existing chips
            editTagChips.chipsData.forEach((chip, index) => {
                editTagChips.deleteChip(0); // Always delete the first element as array shifts
            });
            
            if (item.tags && item.tags.length > 0) {
                item.tags.forEach(tag => {
                    editTagChips.addChip({
                        tag: tag,
                    });
                });
            }
            
            // Update Materialize labels to shrink if content is present
            M.updateTextFields();

            // 更新按鈕事件
            document.getElementById('updateItem').onclick = function() {
                updateItem(id);
            };
            
            M.Modal.getInstance(document.getElementById('editItemModal')).open();
        }

        // 更新商品
        function updateItem(id) {
            const item = items.find(item => item.id === id);
            if (!item) return;
            
            const newTitle = document.getElementById('editItemTitle').value.trim();
            const newPrice = parseFloat(document.getElementById('editItemPrice').value);
            const newUrl = document.getElementById('editItemUrl').value.trim();
            const newNote = document.getElementById('editItemNote').value.trim();
            const newPurchased = document.getElementById('editPurchasedSwitch').checked;

            if (!newTitle || isNaN(newPrice) || !newUrl) {
                showToast('請填寫所有必填欄位', 'error');
                return;
            }
            
            item.title = newTitle;
            item.price = newPrice;
            item.url = newUrl;
            item.note = newNote;
            item.purchased = newPurchased;
            
            // 圖片處理
            const uploadedFile = document.getElementById('editImageUpload').files[0];
            if (uploadedFile) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    item.image = e.target.result;
                    finalizeUpdate();
                };
                reader.readAsDataURL(uploadedFile);
            } else if (document.getElementById('editImageUrl').value.trim()) {
                item.image = document.getElementById('editImageUrl').value.trim();
                finalizeUpdate();
            } else {
                item.image = ''; // Clear image if neither URL nor upload is provided
                finalizeUpdate();
            }
            
            function finalizeUpdate() {
                // 標籤處理
                const editTagChips = M.Chips.getInstance(document.getElementById('editTagChips'));
                item.tags = editTagChips.chipsData.map(chip => chip.tag);
                
                updateAllTags();
                renderItems(items);
                updateTagFilterOptions();
                isDataChanged = true;
                isDataSynced = false;
                
                M.Modal.getInstance(document.getElementById('editItemModal')).close();
                showToast('商品已更新');
            }
        }
    