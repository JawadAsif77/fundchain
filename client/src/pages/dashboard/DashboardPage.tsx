import React from 'react';
import { Box, Grid, Heading, Text, Stat, StatLabel, StatNumber, StatHelpText } from '@chakra-ui/react';

export const DashboardPage = () => {
  return (
    <Box>
      <Heading mb={6}>Dashboard</Heading>
      <Grid templateColumns="repeat(3, 1fr)" gap={6}>
        <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg">
          <Stat>
            <StatLabel>Total Investments</StatLabel>
            <StatNumber>0</StatNumber>
            <StatHelpText>Active Projects</StatHelpText>
          </Stat>
        </Box>
        <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg">
          <Stat>
            <StatLabel>Available Balance</StatLabel>
            <StatNumber>$0.00</StatNumber>
            <StatHelpText>Current Portfolio Value</StatHelpText>
          </Stat>
        </Box>
        <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg">
          <Stat>
            <StatLabel>Returns</StatLabel>
            <StatNumber>0%</StatNumber>
            <StatHelpText>Overall Performance</StatHelpText>
          </Stat>
        </Box>
      </Grid>
    </Box>
  );
};
