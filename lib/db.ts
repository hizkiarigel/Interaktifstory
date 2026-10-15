import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var __pool: mysql.Pool | undefined;
  // eslint-disable-next-line no-var
  var __ready: Promise<void> | undefined;
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    charset: "utf8mb4",
    dateStrings: false,
    // LONGBLOB gambar dikembalikan sebagai Buffer
  });
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS series (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL UNIQUE,
    arc_label VARCHAR(200) NOT NULL DEFAULT ''
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS episodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    series_id INT NOT NULL,
    number INT NOT NULL,
    total INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    tagline TEXT,
    setting VARCHAR(255),
    arc_progress VARCHAR(30),
    genres VARCHAR(255),
    status ENUM('draft','published') NOT NULL DEFAULT 'draft',
    published_at DATETIME NULL,
    source_text MEDIUMTEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_series_number (series_id, number),
    CONSTRAINT fk_ep_series FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS scenes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    episode_id INT NOT NULL,
    kind ENUM('scene','final','status','post','next') NOT NULL,
    number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    meta_time VARCHAR(20) NULL,
    meta_place VARCHAR(255) NULL,
    image_hint VARCHAR(500) NULL,
    blocks_json MEDIUMTEXT NOT NULL,
    sort_order INT NOT NULL,
    UNIQUE KEY uq_scene_key (episode_id, kind, number),
    CONSTRAINT fk_scene_ep FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS scene_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scene_id INT NOT NULL UNIQUE,
    mime VARCHAR(50) NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    bytes INT NOT NULL,
    data LONGBLOB NOT NULL,
    data_sm LONGBLOB NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_img_scene FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    anon_id VARCHAR(40) NOT NULL,
    name VARCHAR(60) NOT NULL,
    episode_id INT NULL,
    scene_key VARCHAR(40) NULL,
    props_json TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_name_time (name, created_at),
    KEY idx_episode (episode_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export function pool(): mysql.Pool {
  if (!global.__pool) global.__pool = createPool();
  return global.__pool;
}

/** Membuat tabel bila belum ada (sekali per proses). Pemilik tidak perlu menjalankan migrasi manual. */
export async function db(): Promise<mysql.Pool> {
  const p = pool();
  if (!global.__ready) {
    global.__ready = (async () => {
      for (const sql of SCHEMA) await p.query(sql);
    })().catch((e) => {
      global.__ready = undefined;
      throw e;
    });
  }
  await global.__ready;
  return p;
}
