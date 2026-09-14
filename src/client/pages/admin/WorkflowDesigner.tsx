import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  MenuItem,
  Grid,
  Divider,
  IconButton,
  List,
  ListItem,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import { motion } from 'framer-motion';

interface Step {
  id: string;
  type: string;
  name: string;
  config: Record<string, string | number | boolean>;
}

interface Workflow {
  _id?: string;
  name: string;
  description: string;
  triggerEvent: string;
  steps: Step[];
  isActive: boolean;
}

export default function WorkflowDesigner() {
  const { data: workflows = [], refetch: fetchWorkflows } = useQuery({
    queryKey: ['workflowDefinitions'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/workflows/definitions');
        return res.data.data as Workflow[];
      } catch {
        return [];
      }
    },
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('SALE_COMPLETED');
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(false);

  const addStep = () => {
    const newStep: Step = {
      id: `step-${Date.now()}`,
      type: 'APPROVAL',
      name: 'Manager Approval Required',
      config: { assignedRole: 'Manager', priority: 'HIGH' },
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    const updated = [...steps];
    updated.splice(index, 1);
    setSteps(updated);
  };

  const updateStepField = (index: number, key: keyof Step, val: string) => {
    const updated = [...steps];
    if (key === 'name' || key === 'type') {
      updated[index][key] = val;
    }
    setSteps(updated);
  };

  const updateStepConfig = (index: number, configKey: string, val: string | number | boolean) => {
    const updated = [...steps];
    updated[index].config = {
      ...updated[index].config,
      [configKey]: val,
    };
    setSteps(updated);
  };

  const handleSave = async () => {
    if (!name || !triggerEvent) {
      toast.error('Please enter a name and trigger event.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/workflows/definitions', {
        name,
        description,
        triggerEvent,
        steps,
        isActive: true,
      });
      toast.success('Workflow saved successfully!');
      setName('');
      setDescription('');
      setSteps([]);
      fetchWorkflows();
    } catch {
      toast.error('Failed to save workflow.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={3}>
      <PageHeader
        title="Visual Workflow BPM Designer"
        subtitle="Orchestrate and automate company procedures dynamically"
      />

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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
                  Create / Edit Workflow
                </Typography>
                <Box component="form" noValidate sx={{ mt: 1 }}>
                  <TextField
                    margin="normal"
                    fullWidth
                    label="Workflow Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    InputLabelProps={{ style: { color: '#aaa' } }}
                    inputProps={{ style: { color: '#fff' } }}
                  />
                  <TextField
                    margin="normal"
                    fullWidth
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    InputLabelProps={{ style: { color: '#aaa' } }}
                    inputProps={{ style: { color: '#fff' } }}
                  />
                  <TextField
                    select
                    margin="normal"
                    fullWidth
                    label="Trigger Event"
                    value={triggerEvent}
                    onChange={(e) => setTriggerEvent(e.target.value)}
                    InputLabelProps={{ style: { color: '#aaa' } }}
                    SelectProps={{ style: { color: '#fff' } }}
                  >
                    <MenuItem value="SALE_COMPLETED">Sale Completed</MenuItem>
                    <MenuItem value="INVENTORY_LOW">Inventory Low</MenuItem>
                    <MenuItem value="PURCHASE_APPROVAL">Purchase Request Approval</MenuItem>
                  </TextField>

                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleSave}
                    disabled={loading}
                    startIcon={<SaveIcon />}
                    sx={{
                      mt: 3,
                      mb: 2,
                      background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                      color: 'white',
                    }}
                  >
                    Save Workflow
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={8}>
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
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" color="primary">
                  Workflow Steps Editor
                </Typography>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={addStep}
                >
                  Add Step
                </Button>
              </Box>
              <Divider sx={{ mb: 2, background: 'rgba(255,255,255,0.1)' }} />

              {steps.length === 0 ? (
                <Typography color="textSecondary" align="center" py={4}>
                  No steps defined yet. Click "Add Step" to start designing the workflow.
                </Typography>
              ) : (
                <List>
                  {steps.map((step, idx) => (
                    <ListItem
                      key={step.id}
                      sx={{
                        mb: 2,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                      }}
                    >
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={3}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Step Type"
                            value={step.type}
                            onChange={(e) => updateStepField(idx, 'type', e.target.value)}
                            SelectProps={{ style: { color: '#fff' } }}
                          >
                            <MenuItem value="START">Start Node</MenuItem>
                            <MenuItem value="APPROVAL">Human Approval</MenuItem>
                            <MenuItem value="NOTIFICATION">Send Alert</MenuItem>
                            <MenuItem value="API_CALL">Trigger Webhook</MenuItem>
                            <MenuItem value="DECISION">Conditional Split</MenuItem>
                            <MenuItem value="END">End Node</MenuItem>
                          </TextField>
                        </Grid>
                        <Grid item xs={4}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Step Name"
                            value={step.name}
                            onChange={(e) => updateStepField(idx, 'name', e.target.value)}
                            inputProps={{ style: { color: '#fff' } }}
                          />
                        </Grid>
                        <Grid item xs={4}>
                          {step.type === 'APPROVAL' && (
                            <TextField
                              fullWidth
                              size="small"
                              label="Approver Role"
                              value={String(step.config.assignedRole || '')}
                              onChange={(e) =>
                                updateStepConfig(idx, 'assignedRole', e.target.value)
                              }
                              inputProps={{ style: { color: '#fff' } }}
                            />
                          )}
                          {step.type === 'NOTIFICATION' && (
                            <TextField
                              fullWidth
                              size="small"
                              label="Alert Body"
                              value={String(step.config.body || '')}
                              onChange={(e) => updateStepConfig(idx, 'body', e.target.value)}
                              inputProps={{ style: { color: '#fff' } }}
                            />
                          )}
                          {step.type === 'API_CALL' && (
                            <TextField
                              fullWidth
                              size="small"
                              label="Webhook URL"
                              value={String(step.config.url || '')}
                              onChange={(e) => updateStepConfig(idx, 'url', e.target.value)}
                              inputProps={{ style: { color: '#fff' } }}
                            />
                          )}
                        </Grid>
                        <Grid item xs={1} display="flex" justifyContent="flex-end">
                          <IconButton color="error" onClick={() => removeStep(idx)}>
                            <DeleteIcon />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
              Active Workflow Definitions
            </Typography>
            <Grid container spacing={2}>
              {workflows.map((w) => (
                <Grid item xs={12} md={4} key={w._id}>
                  <Card
                    sx={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      color: '#fff',
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" color="secondary">
                        {w.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        {w.description || 'No description provided'}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Trigger Event: <strong>{w.triggerEvent}</strong>
                      </Typography>
                      <Typography variant="caption" display="block">
                        Steps Count: <strong>{w.steps.length}</strong>
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
