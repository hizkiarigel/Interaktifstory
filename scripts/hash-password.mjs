import bcrypt from "bcryptjs";
const pw = process.argv[2];
if (!pw) {
  console.error('Pakai: npm run hash -- "kata-sandi-kamu"');
  process.exit(1);
}
const hash = bcrypt.hashSync(pw, 12);
console.log("\nUntuk panel env Hostinger (tempel apa adanya):\n" + hash);
console.log("\nUntuk file .env (tiap $ di-escape):\n" + hash.replace(/\$/g, "\\$") + "\n");
