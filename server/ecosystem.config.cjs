module.exports = {
  apps: [
    {
      name: 'handmade-club',
      script: './index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
