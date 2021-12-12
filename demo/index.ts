import axios from 'axios';
import axiosBetterStacktrace from '../src/axiosBetterStacktrace';

const npmAgent = axios.create({
  baseURL: 'https://npmjs.com',
});

axiosBetterStacktrace(npmAgent);

const getNpmPage = () => npmAgent.get('/<not-found>');

(async () => {
  try {
    await getNpmPage();
  } catch (error) {
    console.log((error as Error).stack);
  }
})();
