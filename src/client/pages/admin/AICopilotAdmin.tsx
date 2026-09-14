import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  MenuItem,
  Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import { motion } from 'framer-motion';

interface PromptTemplate {
  _id?: string;
  name: string;
  category: string;
  templateText: string;
  variables: string[];
}

export default function AICopilotAdmin() {
  const { data: templates = [], refetch: fetchTemplates } = useQuery({
    queryKey: ['copilotTemplates'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/copilot/templates');
        return res.data.data as PromptTemplate[];
      } catch {
        return [];
      }
    },
  });
  const [promptName, setPromptName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [promptCategory, setPromptCategory] = useState('INSIGHTS');

  // Knowledge base states
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docCategory, setDocCategory] = useState<'PRODUCT' | 'POLICY' | 'SOP' | 'FAQ'>('SOP');

  const handleSaveTemplate = async () => {
    if (!promptName || !promptText) {
      toast.error('Please enter prompt name and template text.');
      return;
    }

    try {
      await apiClient.post('/copilot/templates', {
        name: promptName,
        category: promptCategory,
        templateText: promptText,
        variables: ['payload'],
      });
      toast.success('Prompt macro registered successfully!');
      setPromptName('');
      setPromptText('');
      fetchTemplates();
    } catch {
      toast.error('Failed to store prompt template.');
    }
  };

  const handleSaveKnowledge = async () => {
    if (!docTitle || !docContent) {
      toast.error('Please enter document title and content.');
      return;
    }

    try {
      await apiClient.post('/copilot/knowledge', {
        title: docTitle,
        content: docContent,
        category: docCategory,
        metadata: {},
      });
      toast.success('Document indexed successfully in Knowledge Base!');
      setDocTitle('');
      setDocContent('');
    } catch {
      toast.error('Failed to index knowledge document.');
    }
  };

  return (
    <Box p={3}>
      <PageHeader
        title="AI Copilot & Knowledge Console"
        subtitle="Fine-tune prompt libraries, custom workflows models, and RAG document indexing"
      />

      <Grid container spacing={3}>
        {/* Prompts Library Manager */}
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(10px)',
                color: '#fff',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  Prompt Macros Library
                </Typography>
                <Divider sx={{ mb: 2, background: 'rgba(255,255,255,0.1)' }} />
                <Box display="flex" flexDirection="column" gap={2}>
                  <TextField
                    size="small"
                    label="Prompt Name / Shortcut Key"
                    value={promptName}
                    onChange={(e) => setPromptName(e.target.value)}
                    inputProps={{ style: { color: '#fff' } }}
                  />
                  <TextField
                    select
                    size="small"
                    label="Category"
                    value={promptCategory}
                    onChange={(e) => setPromptCategory(e.target.value)}
                    SelectProps={{ style: { color: '#fff' } }}
                  >
                    <MenuItem value="INSIGHTS">BI Insights</MenuItem>
                    <MenuItem value="DECISION">Decision Tree</MenuItem>
                    <MenuItem value="RECONCILIATION">Reconciliation</MenuItem>
                  </TextField>
                  <TextField
                    multiline
                    rows={4}
                    label="Instruction Template Text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    inputProps={{ style: { color: '#fff' } }}
                  />
                  <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveTemplate}>
                    Save Prompt Macro
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Knowledge Base RAG Indexer */}
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(10px)',
                color: '#fff',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom color="secondary">
                  Knowledge Base Indexer
                </Typography>
                <Divider sx={{ mb: 2, background: 'rgba(255,255,255,0.1)' }} />
                <Box display="flex" flexDirection="column" gap={2}>
                  <TextField
                    size="small"
                    label="Document / SOP Title"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    inputProps={{ style: { color: '#fff' } }}
                  />
                  <TextField
                    select
                    size="small"
                    label="Doc Category"
                    value={docCategory}
                    onChange={(e) =>
                      setDocCategory(e.target.value as 'PRODUCT' | 'POLICY' | 'SOP' | 'FAQ')
                    }
                    SelectProps={{ style: { color: '#fff' } }}
                  >
                    <MenuItem value="PRODUCT">Product Specifications</MenuItem>
                    <MenuItem value="POLICY">Return Policies</MenuItem>
                    <MenuItem value="SOP">Standard Operating Procedures</MenuItem>
                    <MenuItem value="FAQ">Frequently Asked Questions</MenuItem>
                  </TextField>
                  <TextField
                    multiline
                    rows={4}
                    label="Document Body Content"
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    inputProps={{ style: { color: '#fff' } }}
                  />
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<AddIcon />}
                    onClick={handleSaveKnowledge}
                  >
                    Index Document Chunks
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Prompts list */}
      <Box mt={4}>
        <Card
          sx={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(10px)',
            color: '#fff',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              Active Prompt Macros
            </Typography>
            <Grid container spacing={2}>
              {templates.map((t) => (
                <Grid item xs={12} md={4} key={t._id}>
                  <Card
                    sx={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      color: '#fff',
                    }}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" color="secondary">
                        <strong>{t.name}</strong>
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        {t.templateText}
                      </Typography>
                      <Typography variant="caption">
                        Category: <strong>{t.category}</strong>
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
