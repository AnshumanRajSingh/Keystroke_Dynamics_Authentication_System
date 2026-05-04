from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import bcrypt
import json, os, smtplib, random, sqlite3
from email.mime.text import MIMEText

app = FastAPI()

# Enable CORS for React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = "keyshield.db"

# --- DATABASE INITIALIZATION ---
def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    # Users table: Stores credentials in a tabular format
    cursor.execute('''CREATE TABLE IF NOT EXISTS users 
                     (username TEXT PRIMARY KEY, 
                      password_hash TEXT, 
                      contact TEXT, 
                      current_otp TEXT)''')
    # Biometric samples table: Linked to users via foreign key
    cursor.execute('''CREATE TABLE IF NOT EXISTS biometric_samples 
                     (username TEXT, 
                      vector_json TEXT,
                      FOREIGN KEY(username) REFERENCES users(username))''')
    conn.commit()
    conn.close()

init_db()

# --- SECURITY HELPERS (Salted Hashing) ---
def get_password_hash(password: str):
    # Salt is automatically generated and embedded in the hash by bcrypt
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str):
    password_byte_enc = plain_password.encode('utf-8')
    hashed_byte_enc = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_byte_enc, hashed_byte_enc)

# --- GMAIL CONFIG ---
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "anshumanrajsingh16@gmail.com" 
SENDER_PASSWORD = "ygmxxkqbjdciynlj" 

def send_otp_email(target_email, otp_code):
    try:
        msg = MIMEText(f"Your KeyShield Security Code: {otp_code}")
        msg['Subject'] = "SECURE ACCESS: OTP Verification"
        msg['From'] = SENDER_EMAIL
        msg['To'] = target_email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        print(f"✅ OTP sent to {target_email}")
    except Exception as e:
        print(f"❌ EMAIL FAIL: {e}")

# --- FEATURE EXTRACTION ---
def extract_features(raw_data):
    if not raw_data or len(raw_data) < 2: 
        return [0.0, 0.0]
    df = pd.DataFrame(raw_data).sort_values(by='timestamp')
    dwells = []
    for key in df['key'].unique():
        k_events = df[df['key'] == key]
        downs = k_events[k_events['event'] == 'keydown']['timestamp'].values
        ups = k_events[k_events['event'] == 'keyup']['timestamp'].values
        for i in range(min(len(downs), len(ups))):
            dwells.append(float(ups[i] - downs[i]))
    return [float(np.mean(dwells)), float(np.std(dwells))]

# --- API ENDPOINTS ---

@app.post("/register")
async def register(request: Request):
    body = await request.json()
    uid = body.get('username')
    plain_password = body.get('password')
    contact = body.get('contact')
    vector = extract_features(body.get('rhythm_data', []))
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # 1. Salt and Hash the password
    hashed_pw = get_password_hash(plain_password)
    
    # 2. Check/Insert User
    cursor.execute("SELECT username FROM users WHERE username = ?", (uid,))
    if not cursor.fetchone():
        cursor.execute("INSERT INTO users (username, password_hash, contact) VALUES (?, ?, ?)", 
                       (uid, hashed_pw, contact))
    
    # 3. Add Biometric Sample
    cursor.execute("INSERT INTO biometric_samples (username, vector_json) VALUES (?, ?)", 
                   (uid, json.dumps(vector)))
    
    cursor.execute("SELECT COUNT(*) FROM biometric_samples WHERE username = ?", (uid,))
    count = cursor.fetchone()[0]
    
    conn.commit()
    conn.close()
    return {"message": f"Sample {count}/5 Saved", "status": "info"}

@app.post("/login")
async def login(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()
    uid = body.get('username')
    prov_pass = body.get('password')
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # 1. Fetch Tabular Data
    cursor.execute("SELECT password_hash, contact FROM users WHERE username = ?", (uid,))
    user = cursor.fetchone()
    
    # 2. Verify Salted Password
    if not user or not verify_password(prov_pass, user[0]):
        conn.close()
        return {"message": "INVALID CREDENTIALS", "status": "error"}
    
    # 3. Get Biometric Samples for Profile
    cursor.execute("SELECT vector_json FROM biometric_samples WHERE username = ?", (uid,))
    rows = cursor.fetchall()
    samples = [json.loads(r[0]) for r in rows]
    
    if len(samples) < 5:
        conn.close()
        return {"message": "PROFILE INCOMPLETE", "status": "error"}

    # 4. Rhythm Analytics using Isolation Forest
    current_vector = extract_features(body.get('rhythm_data', []))
    model = IsolationForest(contamination=0.1, random_state=42).fit(samples)
    
    if model.predict([current_vector])[0] == 1:
        conn.close()
        return {"message": "MATCH GRANTED", "status": "success"}
    else:
        # MFA Trigger: Generate and store OTP
        otp = str(random.randint(100000, 999999))
        cursor.execute("UPDATE users SET current_otp = ? WHERE username = ?", (otp, uid))
        conn.commit()
        conn.close()
        background_tasks.add_task(send_otp_email, user[1], otp)
        return {"message": "RHYTHM MISMATCH: OTP SENT", "status": "otp_required"}

@app.post("/verify-otp")
async def verify_otp(request: Request):
    body = await request.json()
    uid, user_otp = body.get('username'), body.get('otp')
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT current_otp FROM users WHERE username = ?", (uid,))
    result = cursor.fetchone()
    
    if result and result[0] == user_otp:
        # Clear OTP after use
        cursor.execute("UPDATE users SET current_otp = NULL WHERE username = ?", (uid,))
        conn.commit()
        conn.close()
        return {"message": "OTP VERIFIED", "status": "success"}
    
    conn.close()
    return {"message": "INVALID OTP", "status": "error"}