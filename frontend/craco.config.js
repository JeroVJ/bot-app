module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      return webpackConfig;
    }
  },
  devServer: {
    allowedHosts: 'all'
  }
};
