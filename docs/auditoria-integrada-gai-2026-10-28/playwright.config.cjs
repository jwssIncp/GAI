const path=require('node:path');
const {defineConfig,devices}=require('../../gai-frontend/node_modules/@playwright/test');
module.exports=defineConfig({testDir:'./e2e',fullyParallel:false,workers:1,retries:0,timeout:240000,expect:{timeout:15000},outputDir:'./evidencias/playwright',reporter:[['list'],['json',{outputFile:path.join(__dirname,'evidencias/playwright.json')}]],use:{baseURL:'http://127.0.0.1:33320',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'chromium-real',use:{...devices['Desktop Chrome']}}]});
