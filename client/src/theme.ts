import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'gray.50',
      },
    },
  },
  colors: {
    brand: {
      50: '#E6F6FF',
      100: '#BAE3FF',
      500: '#2B6CB0',
      600: '#2C5282',
      700: '#2A4365',
    },
  },
});

export default theme;
