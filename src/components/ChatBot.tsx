import { useState } from 'react';
import {
  Box,
  VStack,
  Input,
  Button,
  Text,
  Flex,
  useToast,
  Container,
} from '@chakra-ui/react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ChatBot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      // Add assistant message
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.response 
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to get response from chatbot',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxW="container.md" py={4}>
      <VStack spacing={4} align="stretch">
        <Box
          height="400px"
          overflowY="auto"
          p={4}
          borderWidth={1}
          borderRadius="md"
          bg="gray.50"
        >
          {messages.map((message, index) => (
            <Flex
              key={index}
              justify={message.role === 'user' ? 'flex-end' : 'flex-start'}
              mb={2}
            >
              <Box
                maxW="70%"
                p={3}
                borderRadius="lg"
                bg={message.role === 'user' ? 'blue.500' : 'gray.200'}
                color={message.role === 'user' ? 'white' : 'black'}
              >
                <Text>{message.content}</Text>
              </Box>
            </Flex>
          ))}
        </Box>

        <form onSubmit={handleSubmit}>
          <Flex>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about campaign finance data..."
              mr={2}
              disabled={isLoading}
            />
            <Button
              type="submit"
              colorScheme="blue"
              isLoading={isLoading}
              loadingText="Thinking..."
            >
              Send
            </Button>
          </Flex>
        </form>
      </VStack>
    </Container>
  );
};

export default ChatBot; 