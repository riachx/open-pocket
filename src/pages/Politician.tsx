import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
Box,
Container,
Image,
VStack,
Heading,
Text,
Spinner,
Center,
Grid,
Button,
Flex,
Table,
Thead,
Tbody,
Tr,
Th,
Td,
Badge,
Stat,
StatLabel,
StatNumber,
StatGroup,
Input,
IconButton,
Avatar,
Divider,
} from '@chakra-ui/react';
import { ArrowBackIcon, ArrowForwardIcon } from '@chakra-ui/icons';
import ChatBot from '../components/ChatBot';
import RecentVoteInfo from '../components/RecentVoteInfo';
import CongressmanBanner from '../components/CongressmanBanner';
import CommitteesSection from '../components/CommitteesSection';

interface Congressman {
id: number;
name: string;
state: string;
party: string;
chamber: string;
image: string;
congress: number;
bioguide_id: string;
}

interface CommitteeContribution {
name: string;
  entity_type: string;
  total_amount: number;
  transaction_count: number;
}

interface Message {
role: 'user' | 'assistant';
content: string;
}


interface VoteInfo {
votes: Array<{
congress: number;
session: number;
voteNumber: number;
legislation: string;
result: string;
date: string;
question: string;
voteCast?: string;
billInfo?: {
title?: string;
shortTitle?: string;
latestAction?: string;
policyArea?: string;
legislativeSubjects?: string[];
};
}>;
}

const Politician = () => {
const { id } = useParams();
const navigate = useNavigate();
const [congressman, setCongressman] = useState<Congressman | null>(null);
const [committees, setCommittees] = useState<CommitteeContribution[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isLoadingCommittees, setIsLoadingCommittees] = useState(true);
const [isLoadingVotes, setIsLoadingVotes] = useState(true);
const [error, setError] = useState<string | null>(null);
const [committeesError, setCommitteesError] = useState<string | null>(null);
const [messages, setMessages] = useState<Message[]>([]);
const [userInput, setUserInput] = useState('');
const [isTyping, setIsTyping] = useState(false);
const [voteInfo, setVoteInfo] = useState<VoteInfo | null>(null);
const messagesEndRef = useRef<HTMLDivElement>(null);
const [testStatus, setTestStatus] = useState<{
loading: boolean;
success: boolean | null;
message: string;
data: any;
}>({
loading: false,
success: null,
message: '',
data: null
});

// Test function to verify Congress API
const testCongressAPI = async () => {
setTestStatus({
loading: true,
success: null,
message: 'Testing Congress.gov API...',
data: null
});

try {
console.log('Testing Congress.gov API...');

// Using a different member ID format (H001053 for Rep. Hakeem Jeffries)
const memberId = 'H001053';

// Test 0: Get basic member information first
const memberResponse = await fetch(
`https://api.congress.gov/v3/member?api_key=${import.meta.env.VITE_CONGRESS_API_KEY}&format=json&bioguideId=${memberId}`,
{
headers: {
'Accept': 'application/json'
}
}
);

if (!memberResponse.ok) {
throw new Error(`Failed to get member info: ${memberResponse.status}`);
}

const memberData = await memberResponse.json();
console.log('Member Info:', memberData);

setTestStatus({
loading: false,
success: true,
message: 'Congress.gov API Test Successful!',
data: memberData
});

return true;
} catch (error) {
console.error('Congress.gov API Test Failed:', error);
setTestStatus({
loading: false,
success: false,
message: error instanceof Error ? error.message : 'API Test Failed',
data: null
});
return false;
}
};

// Function to fetch most recent House vote
const fetchMostRecentVote = async () => {
try {
const apiKey = import.meta.env.VITE_CONGRESS_API_KEY;
if (!apiKey) {
throw new Error('Congress.gov API key is not set in environment variables');
}

console.log('Starting to fetch 2 most recent votes...');

// First get the most recent votes
const voteResponse = await fetch(
`https://api.congress.gov/v3/house-vote?api_key=${apiKey}&format=json&congress=119&limit=50`,
{
headers: {
'Accept': 'application/json'
}
}
);

if (!voteResponse.ok) {
throw new Error(`Failed to fetch most recent votes: ${voteResponse.status}`);
}

const voteData = await voteResponse.json();
console.log('Raw vote data:', JSON.stringify(voteData, null, 2));

const recentVotes = voteData.houseRollCallVotes;
console.log('All votes:', recentVotes.map((v: {
startDate: string;
question: string;
rollCallNumber: number;
}) => ({
date: v.startDate,
question: v.question,
rollCall: v.rollCallNumber
})));

if (!recentVotes?.length) {
throw new Error('No votes found in response');
}

// Sort votes by date, most recent first
const sortedVotes = [...recentVotes].sort((a, b) => 
new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
);
console.log('Sorted votes by date:', sortedVotes.map((v: {
startDate: string;
question: string;
rollCallNumber: number;
}) => ({
date: v.startDate,
question: v.question,
rollCall: v.rollCallNumber
})));

// Take only the 3 most recent votes
const mostRecentVotes = sortedVotes.slice(0, 3);
console.log('Most recent 3 votes:', mostRecentVotes.map((v: {
startDate: string;
question: string;
rollCallNumber: number;
}) => ({
date: v.startDate,
question: v.question,
rollCall: v.rollCallNumber
})));

// Process each vote
const processedVotes = await Promise.all(mostRecentVotes.map(async (vote: {
congress: number;
sessionNumber: number;
rollCallNumber: number;
legislationType: string;
legislationNumber: number;
result: string;
startDate: string;
question: string;
billInfo?: {
title?: string;
shortTitle?: string;
latestAction?: string;
policyArea?: string;
};
}) => {
console.log('Processing vote:', vote);

// Fetch bill title and subjects
const [billTitleResponse, subjectsResponse] = await Promise.all([
fetch(
`https://api.congress.gov/v3/bill/${vote.congress}/${vote.legislationType.toLowerCase()}/${vote.legislationNumber}/titles?api_key=${apiKey}&format=json`,
{
headers: {
'Accept': 'application/json'
}
}
),
fetch(
`https://api.congress.gov/v3/bill/${vote.congress}/${vote.legislationType.toLowerCase()}/${vote.legislationNumber}/subjects?api_key=${apiKey}&format=json`,
{
headers: {
'Accept': 'application/json'
}
}
)
]);

if (!billTitleResponse.ok) {
console.error(`Failed to fetch bill title for vote ${vote.rollCallNumber}`);
return null;
}

const billTitleData = await billTitleResponse.json();
const subjectsData = await subjectsResponse.json();
console.log('Bill title data:', billTitleData);
console.log('Subjects data:', subjectsData);

const displayTitle = billTitleData.titles?.find((title: any) => title.titleType === "Display Title")?.title || 
`${vote.legislationType}${vote.legislationNumber}`;
const policyArea = subjectsData.subjects?.policyArea?.name;
const legislativeSubjects = subjectsData.subjects?.legislativeSubjects?.map((subject: any) => subject.name)?.slice(0, 8) || [];
console.log('Display title:', displayTitle);
console.log('Policy area:', policyArea);
console.log('Legislative subjects:', legislativeSubjects);

// Get member votes for this specific vote
const membersResponse = await fetch(
`https://api.congress.gov/v3/house-vote/${vote.congress}/${vote.sessionNumber}/${vote.rollCallNumber}/members?api_key=${apiKey}&format=json`,
{
headers: {
'Accept': 'application/json'
}
}
);

if (!membersResponse.ok) {
console.error(`Failed to fetch member votes for vote ${vote.rollCallNumber}`);
return null;
}

const membersData = await membersResponse.json();
console.log('Raw members data:', JSON.stringify(membersData, null, 2));

// Try different possible paths to find member votes
const possiblePaths = [
membersData.houseRollCallMemberVotes?.[0]?.members,
membersData.houseRollCallVoteMemberVotes?.results,
membersData.results,
membersData.members
];


// Find the first non-empty array
const memberVotes = possiblePaths.find(arr => Array.isArray(arr) && arr.length > 0) || [];


// Find this congressman's vote
const congressmanVote = memberVotes.find(
(member: any) => {

return member.bioguideID === congressman?.bioguide_id;
}
);


const voteCast = congressmanVote?.voteCast;


const voteResult = {
congress: vote.congress,
session: vote.sessionNumber,
voteNumber: vote.rollCallNumber,
legislation: displayTitle,
result: vote.result,
date: vote.startDate,
question: vote.question,
voteCast: voteCast,
billInfo: {
title: displayTitle,
policyArea: policyArea,
legislativeSubjects: legislativeSubjects
}
};
console.log('Final vote result object:', voteResult);

return voteResult;
}));

// Filter out any null results and set the vote info
const validVotes = processedVotes.filter(vote => vote !== null);
console.log('Valid votes:', validVotes);

const voteResult = { votes: validVotes };
console.log('Final vote result:', voteResult);

setVoteInfo(voteResult);
return voteResult;
} catch (error) {
console.error('Error in fetchMostRecentVote:', error);
if (error instanceof Error) {
console.error('Error details:', {
message: error.message,
stack: error.stack
});
}
return null;
}
};

// Call test function when component mounts
useEffect(() => {
console.log('Component mounted - testing Congress API');
testCongressAPI();
}, []);

// Separate useEffect for fetching votes
useEffect(() => {
console.log('Component mounted - fetching votes');
if (congressman?.bioguide_id) {
console.log('Fetching votes for congressman:', congressman.bioguide_id);
setIsLoadingVotes(true);
fetchMostRecentVote().then(result => {
if (result) {
console.log('Successfully fetched vote and member data:', result);
console.log('Setting voteInfo with:', result);
}
setIsLoadingVotes(false);
}).catch(error => {
console.error('Error fetching votes:', error);
setIsLoadingVotes(false);
});
} else {
console.log('No congressman bioguide_id available yet');
}
}, [congressman?.bioguide_id]);

// Initialize chat messages when congressman data is loaded
useEffect(() => {
if (congressman && messages.length === 0) {
setMessages([
{
role: 'assistant' as const,
content: `Hi there! I'm your AI assistant. I can help answer questions about ${congressman.name}'s campaign financing and political background. What would you like to know?`
}
]);
}
}, [congressman, messages.length]);

// Fetch congressman details
useEffect(() => {
const fetchCongressmanDetails = async () => {
try {
const response = await fetch(`http://localhost:3001/api/congressman/${id}`, {
headers: {
'x-api-key': import.meta.env.VITE_CONGRESS_API_KEY || ''
}
});
if (!response.ok) {
throw new Error('Failed to fetch congressman details');
}
const data = await response.json();
setCongressman(data);
setIsLoading(false);
} catch (err) {
setError(err instanceof Error ? err.message : 'An error occurred');
setIsLoading(false);
}
};

fetchCongressmanDetails();
}, [id]);

  // Fetch committee contributions
useEffect(() => {
    const fetchCommitteeContributions = async () => {
if (!id) return;

try {
setIsLoadingCommittees(true);
console.log('Fetching committee contributions for politician ID:', id);

let url = `http://localhost:3001/api/congressman/${id}/committees`;

// Use the direct endpoint for a specific congressman
const response = await fetch(url, {
headers: {
'x-api-key': import.meta.env.VITE_CONGRESS_API_KEY || ''
}
});

// Even if we get a 404 or 500, we'll still try to parse the response
// This is to handle the case where the server returns an empty array
const data = await response.json().catch(() => []);
console.log('Received committee data:', data);

// Extract contributions from debug endpoint if needed
const contributionsData = id === '1282' && data.contributions ? data.contributions : data;

// Ensure we have array data
const contributions = Array.isArray(contributionsData) ? contributionsData : [];
console.log('Found committee contributions:', contributions.length);

setCommittees(contributions);
} catch (err) {
        console.error('Error fetching committee contributions:', err);
setCommitteesError(err instanceof Error ? err.message : 'Failed to fetch committee data');
        // Don't set empty array here to avoid losing data if it was loaded successfully before
} finally {
setIsLoadingCommittees(false);
}
};

//fetchCommitteeContributions();
}, [id]);

  // Calculate total contributions
  const totalContributions = committees.reduce((sum, committee) => sum + committee.total_amount, 0);

// Add a function to handle sending messages
const handleSendMessage = async () => {
if (!userInput.trim() || !congressman) return;

// Add user message
const newMessages = [...messages, { role: 'user' as const, content: userInput.trim() }];
setMessages(newMessages);
setUserInput('');
setIsTyping(true);

try {
// Call the LangChain chat endpoint
const response = await fetch('http://localhost:3001/api/chat', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
},
body: JSON.stringify({
message: userInput.trim()
}),
});

if (!response.ok) {
throw new Error('Failed to get response from chat endpoint');
}

const data = await response.json();

setMessages([...newMessages, { role: 'assistant' as const, content: data.response }]);
} catch (error) {
console.error('Error calling chat endpoint:', error);
setMessages([
...newMessages,
{
role: 'assistant' as const,
content: `I'm sorry, I encountered an error while processing your request. Please try again later.`
}
]);
} finally {
setIsTyping(false);
}
};

// Add effect to scroll to bottom of messages
useEffect(() => {
// Only scroll if we have more than the initial welcome message
if (messages.length > 1) {
messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}
}, [messages]);

if (isLoading) {
return (
<Container maxW="container.xl" py={8}>
<Center h="60vh">
<Spinner size="xl" />
</Center>
</Container>
);
}


if (error) {
return (
<Container maxW="container.xl" py={8}>
<VStack spacing={4} align="stretch">
<Button
leftIcon={<ArrowBackIcon />}
onClick={() => navigate('/profile')}
colorScheme="blue"
width="fit-content"

>
Back to Politicians
</Button>
<Center h="60vh">
<Text color="red.500">Error: {error}</Text>
</Center>
</VStack>
</Container>
);
}

if (!congressman) {
return (
<Container maxW="container.xl" py={8}>
<VStack spacing={4} align="stretch">
<Button
leftIcon={<ArrowBackIcon />}
onClick={() => navigate('/profile')}
colorScheme="blue"
width="fit-content"
>
Back to Politicians
</Button>
<Center h="60vh">
<Text>Politician not found</Text>
</Center>
</VStack>
</Container>
);
}
console.log(congressman)
return (
<Container maxW="container.xl" py={8}>
<VStack align="stretch" spacing={6}>
<Button 
leftIcon={<ArrowBackIcon />} 
onClick={() => navigate('/profile')}
colorScheme="blue"
width="fit-content"
>
Back to Politicians
</Button>

{/* Congressman Banner */}
{congressman && (
<CongressmanBanner
name={congressman.name}
party={congressman.party}
state={congressman.state}
image={congressman.image}
/>
)}


{/* Recent Vote Information */}
<RecentVoteInfo 
voteInfo={voteInfo} 
congressmanId={congressman?.bioguide_id || ""}
isLoading={isLoadingVotes}
/>

{/* Main Content Grid */}
<Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={8}>
{/* Left Column */}
<VStack spacing={8}>
            {/* Committees Section */}
            <CommitteesSection
              committees={committees}
              isLoading={isLoadingCommittees}
              error={committeesError}
            />

{/* Industries Box */}
<Box
bg="white"
p={6}
borderRadius="xl"
boxShadow="md"
width="100%"
              height="400px"
>
<Heading size="lg" mb={4}>INDUSTRIES</Heading>
              <Text color="gray.500">Industry information will be added here...</Text>
</Box>
</VStack>

{/* Right Column - ChatBot */}
<Box
bg="white"
p={6}
borderRadius="xl"
boxShadow="md"
height="fit-content"
position="sticky"
top="20px"
>
<Heading size="md" mb={4}>Ask about Campaign Finance</Heading>
<ChatBot />
</Box>
</Grid>
</VStack>
</Container>
);
};

export default Politician;
