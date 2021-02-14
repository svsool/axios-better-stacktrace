import axios from 'axios';
import axiosBetterStacktrace from '../src/axiosBetterStacktrace';

const npmAgent = axios.create({
  baseURL: 'https://npmjs.com',
});

axiosBetterStacktrace(npmAgent);

const getNpmPage = () => npmAgent.get('/<not-found>');

(async () => {
  // it should print an enhanced error to the terminal upon the run
  await getNpmPage();
})();
