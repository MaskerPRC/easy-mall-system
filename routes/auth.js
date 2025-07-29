const express = require('express');
const { getDB } = require('../database/init');

const router = express.Router();

// 管理员登录验证
router.post('/admin/login', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      error: '参数错误',
      message: '请提供访问令牌'
    });
  }

  const db = getDB();
  db.get(
    'SELECT config_value FROM system_config WHERE config_key = ?',
    ['admin_token'],
    (err, row) => {
      if (err) {
        console.error('验证token失败:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      if (!row || row.config_value !== token) {
        return res.status(401).json({
          error: '登录失败',
          message: '无效的访问令牌'
        });
      }

      res.json({
        success: true,
        message: '登录成功',
        data: {
          token,
          role: 'admin'
        }
      });
    }
  );
  db.close();
});

// 获取当前配置的令牌（仅用于开发调试）
router.get('/admin/token', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: '接口不存在' });
  }

  const db = getDB();
  db.get(
    'SELECT config_value FROM system_config WHERE config_key = ?',
    ['admin_token'],
    (err, row) => {
      if (err) {
        console.error('获取token失败:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      res.json({
        token: row?.config_value || 'admin123456',
        message: '这是开发环境下的默认令牌，生产环境请修改'
      });
    }
  );
  db.close();
});

// 修改管理员令牌
router.put('/admin/token', (req, res) => {
  const { currentToken, newToken } = req.body;

  if (!currentToken || !newToken) {
    return res.status(400).json({
      error: '参数错误',
      message: '请提供当前令牌和新令牌'
    });
  }

  if (newToken.length < 8) {
    return res.status(400).json({
      error: '参数错误',
      message: '新令牌长度不能少于8个字符'
    });
  }

  const db = getDB();
  
  // 验证当前令牌
  db.get(
    'SELECT config_value FROM system_config WHERE config_key = ?',
    ['admin_token'],
    (err, row) => {
      if (err) {
        console.error('验证当前token失败:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      if (!row || row.config_value !== currentToken) {
        return res.status(401).json({
          error: '验证失败',
          message: '当前令牌无效'
        });
      }

      // 更新令牌
      db.run(
        'UPDATE system_config SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?',
        [newToken, 'admin_token'],
        function(err) {
          if (err) {
            console.error('更新token失败:', err);
            return res.status(500).json({ error: '更新失败' });
          }

          res.json({
            success: true,
            message: '令牌更新成功',
            data: {
              newToken
            }
          });
        }
      );
    }
  );
  
  db.close();
});

module.exports = router; 