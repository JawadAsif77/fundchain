import React from 'react';
import { Box, Button, FormControl, FormLabel, Input, VStack, Heading, Text } from '@chakra-ui/react';

export const LoginPage = () => {
  return (
    <Box maxW="md" mx="auto" mt={8}>
      <VStack spacing={4} p={8} borderRadius="lg" boxShadow="lg" bg="white">
        <Heading size="lg">Login</Heading>
        <FormControl>
          <FormLabel>Email</FormLabel>
          <Input type="email" placeholder="Enter your email" />
        </FormControl>
        <FormControl>
          <FormLabel>Password</FormLabel>
          <Input type="password" placeholder="Enter your password" />
        </FormControl>
        <Button colorScheme="blue" width="full">
          Sign In
        </Button>
        <Text>Don't have an account? Sign up</Text>
      </VStack>
    </Box>
  );
};
