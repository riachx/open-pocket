// src/pages/Profile.tsx
import {
    Container,
    Heading,
    VStack,
    Box,
    Text,
    Tabs,
    TabList,
    TabPanels,
    Tab,
    TabPanel,
    Avatar,
    SimpleGrid,
    Card,
    CardBody
  } from '@chakra-ui/react';
  
  const Profile = () => {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Box textAlign="center">
            <Avatar size="2xl" name="User Name" mb={4} />
            <Heading size="lg">User Name</Heading>
            <Text color="gray.600">user@email.com</Text>
          </Box>
  
          <Tabs isFitted variant="enclosed">
            <TabList mb="1em">
              <Tab>Saved Politicians</Tab>
              <Tab>Tracked PACs</Tab>
              <Tab>Settings</Tab>
            </TabList>
  
            <TabPanels>
              <TabPanel>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                  {/* Example saved politician card */}
                  <Card>
                    <CardBody>
                      <Heading size="md">Saved Politician</Heading>
                      <Text>Last Updated: 01/01/2024</Text>
                    </CardBody>
                  </Card>
                </SimpleGrid>
              </TabPanel>
  
              <TabPanel>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                  {/* Example tracked PAC card */}
                  <Card>
                    <CardBody>
                      <Heading size="md">Tracked PAC</Heading>
                      <Text>Last Updated: 01/01/2024</Text>
                    </CardBody>
                  </Card>
                </SimpleGrid>
              </TabPanel>
  
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Box p={4} borderWidth="1px" borderRadius="lg">
                    <Heading size="md" mb={2}>Account Settings</Heading>
                    <Text>Email Notifications: On</Text>
                    <Text>Dark Mode: Off</Text>
                  </Box>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
      </Container>
    );
  };
  
  export default Profile;