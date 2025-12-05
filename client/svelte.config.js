import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      // 静态导出目录，对应我们 CI 里要上传的路径
      pages: 'build',
      assets: 'build',
      fallback: 'index.html'
    })
  }
};

export default config;