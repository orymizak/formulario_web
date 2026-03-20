const { Sequelize, DataTypes, Op } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'contactos_db',
  process.env.DB_USER || 'app_user',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',

    logging: (msg) => logger.debug(msg),
    benchmark: true,

    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      acquire: 30000,
      idle: 10000,
    },

    dialectOptions: process.env.DB_SSL === 'true'
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},

    retry: {
      max: 3,
    },

    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
    },
  }
);

// ─── MODELO: Contacto ────────────────────────────────────────────────────────
const Contacto = sequelize.define('Contacto', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  nombre: {
    type: DataTypes.STRING(80),
    allowNull: false,
    validate: { notEmpty: true, len: [2, 80] },
  },

  apellido: {
    type: DataTypes.STRING(80),
    allowNull: false,
    validate: { notEmpty: true, len: [2, 80] },
  },

  email: {
    type: DataTypes.STRING(254),
    allowNull: false,
    validate: { isEmail: true },
  },

  telefono: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      is: /^[0-9+\-\s()]+$/,
    },
  },

  curp: {
    type: DataTypes.STRING(18),
    allowNull: true,
    validate: {
      is: /^[A-Z0-9]{18}$/i,
      len: [18, 18],
    },
  },

  empresa: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },

  fuente: {
    type: DataTypes.STRING,
    validate: {
      isIn: [['Referido', 'Portafolio', 'LinkedIn', 'Indeed', 'Sitio Web', 'Evento', 'Otro']],
    },
    allowNull: true,
  },

  tags: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
  },

  notas: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // Seguridad
  ipOrigen: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },

  deviceFingerprint: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },

  emailVerificado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  idempotencyKey: {
    type: DataTypes.UUID,
    allowNull: true,
  },

  fotoKey: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Ruta del archivo de foto en S3'
  },

  ineKey: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Ruta del archivo de INE en S3'
  },

}, {
  tableName: 'contactos',

  hooks: {
    beforeValidate: (contacto) => {
      if (contacto.email) {
        contacto.email = contacto.email.toLowerCase().trim();
      }
    },
  },

  indexes: [
    // email único (case-insensitive)
    {
      unique: true,
      fields: [sequelize.fn('lower', sequelize.col('email'))],
    },

    // teléfono único
    {
      unique: true,
      fields: ['telefono'],
    },

    // CURP único (solo si no es null)
    {
      unique: true,
      fields: ['curp'],
      where: { curp: { [Op.ne]: null } },
    },

    { fields: ['created_at'] },

    // idempotencia (solo si no es null)
    {
      fields: ['idempotency_key'],
      unique: true,
      where: {
        idempotency_key: {
          [Op.ne]: null,
        },
      },
    },

    // JSONB optimizado
    {
      fields: ['tags'],
      using: 'gin',
    },

    // índices útiles reales
    { fields: ['ip_origen'] },
    { fields: ['device_fingerprint'] },
    { fields: ['email', 'created_at'] },
  ],
});

// ─── MODELO: AuditLog ────────────────────────────────────────────────────────
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },

  event: {
    type: DataTypes.STRING(60),
    allowNull: false,
  },

  status: {
    type: DataTypes.STRING(20), // success, error, blocked
    allowNull: true,
  },

  email: {
    type: DataTypes.STRING(254),
    allowNull: true,
  },

  ip: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },

  fingerprint: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },

  requestId: {
    type: DataTypes.UUID,
    allowNull: true,
  },

  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },

}, {
  tableName: 'audit_logs',
  updatedAt: false,
  paranoid: false,

  indexes: [
    { fields: ['event'] },
    { fields: ['status'] },
    { fields: ['email'] },
    { fields: ['ip'] },
    { fields: ['created_at'] },
  ],
});

// ─── MODELO: AdminUser ───────────────────────────────────────────────────────
const AdminUser = sequelize.define('AdminUser', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
}, {
  tableName: 'admin_users',
  paranoid: false,
  updatedAt: false,
});

module.exports = { sequelize, Contacto, AuditLog, AdminUser };