import bcrypt from "bcryptjs";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const envPath = join(projectRoot, ".env");

// 새 비밀번호를 인자로 받거나 자동 생성
const newPassword = process.argv[2] || generateRandomPassword();

console.log("=== Admin 계정 비밀번호 설정 ===");
console.log("Username: lifefit");
console.log("New Password:", newPassword);
console.log("");

// 비밀번호 해시 생성
const hash = await bcrypt.hash(newPassword, 10);
console.log("Password Hash:", hash);
console.log("");

// .env 파일 읽기 또는 생성
let envContent = "";
if (existsSync(envPath)) {
  envContent = readFileSync(envPath, "utf-8");
} else {
  console.log(".env 파일이 없습니다. 새로 생성합니다.");
}

// ADMIN_USERNAME과 ADMIN_PASSWORD_HASH 업데이트
const lines = envContent.split("\n");
let updated = false;
let usernameUpdated = false;
let passwordUpdated = false;

const newLines = lines.map((line) => {
  if (line.startsWith("ADMIN_USERNAME=")) {
    usernameUpdated = true;
    updated = true;
    return `ADMIN_USERNAME=lifefit`;
  }
  if (line.startsWith("ADMIN_PASSWORD_HASH=")) {
    passwordUpdated = true;
    updated = true;
    return `ADMIN_PASSWORD_HASH=${hash}`;
  }
  return line;
});

// 없으면 추가
if (!usernameUpdated) {
  newLines.push(`ADMIN_USERNAME=lifefit`);
  updated = true;
}
if (!passwordUpdated) {
  newLines.push(`ADMIN_PASSWORD_HASH=${hash}`);
  updated = true;
}

// .env 파일 저장
writeFileSync(envPath, newLines.join("\n"), "utf-8");

console.log("✓ .env 파일이 업데이트되었습니다.");
console.log("");
console.log("=== 설정 완료 ===");
console.log("Username: lifefit");
console.log("Password:", newPassword);
console.log("");
console.log("⚠️  이 비밀번호를 안전한 곳에 저장하세요!");
console.log("⚠️  서버를 재시작해야 변경사항이 적용됩니다.");

function generateRandomPassword() {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

