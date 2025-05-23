from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)  # <<<<--- 這一行解決 CORS 問題
#CORS(app, origins=["https://*.trycloudflare.com", "https://voted-attempts-wealth-wma.trycloudflare.com ,"http://localhost:8080", "http://127.0.0.1:8080"])

# 資料儲存目錄
DATA_DIR = "user_data"
os.makedirs(DATA_DIR, exist_ok=True)

@app.route('/api/login', methods=['POST'])
def login():
    username = request.json.get('username', '').strip()
    if not username:
        return jsonify({"success": False, "message": "請輸入使用者名稱"}), 400
    
    user_file = os.path.join(DATA_DIR, f"{username}.json")
    
    # 如果檔案不存在，視為新用戶
    if not os.path.exists(user_file):
        with open(user_file, 'w', encoding='utf-8') as f:
            json.dump([], f)
        return jsonify({"success": True, "data": [], "isNewUser": True})
    
    # 讀取現有用戶資料
    with open(user_file, 'r', encoding='utf-8') as f:
        user_data = json.load(f)
    return jsonify({"success": True, "data": user_data, "isNewUser": False})

@app.route('/api/save', methods=['POST'])
def save_data():
    username = request.json.get('username', '').strip()
    items = request.json.get('items', [])
    
    if not username:
        return jsonify({"success": False, "message": "無效的使用者名稱"}), 400
    
    # 儲存用戶資料
    user_file = os.path.join(DATA_DIR, f"{username}.json")
    with open(user_file, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
