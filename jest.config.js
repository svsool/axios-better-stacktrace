process.env.NODE_ENV = 'test';

module.exports = {
  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  testEnvironment: 'node',
  modulePaths: ['src'],
};
