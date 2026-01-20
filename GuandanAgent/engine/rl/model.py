
import torch
import torch.nn as nn
import torch.nn.functional as F
import os

class GuandanValueNet(nn.Module):
    def __init__(self, input_dim=120, hidden_dim=128):
        """
        Simple Value Network for Guandan.
        Input: Feature vector of the game state.
        Output: Value in [-1, 1] (1 = Team 0 wins, -1 = Team 1 wins).
        """
        super(GuandanValueNet, self).__init__()
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, hidden_dim)
        self.fc3 = nn.Linear(hidden_dim, 1)
        
    def forward(self, x):
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = torch.tanh(self.fc3(x)) # Output between -1 and 1
        return x

class ModelManager:
    def __init__(self, model_path="model_v1.pth"):
        self.model_path = model_path
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = GuandanValueNet().to(self.device)
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=0.001)
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.model.load_state_dict(torch.load(self.model_path, map_location=self.device))
                self.model.eval()
                print(f"Loaded model from {self.model_path}")
            except Exception as e:
                print(f"Failed to load model: {e}")
        else:
            print("No existing model found. Starting fresh.")

    def save_model(self):
        tmp_path = self.model_path + ".tmp"
        torch.save(self.model.state_dict(), tmp_path)
        try:
            if os.path.exists(self.model_path):
                os.replace(tmp_path, self.model_path)
            else:
                os.rename(tmp_path, self.model_path)
            print(f"Saved model to {self.model_path}")
        except OSError as e:
            print(f"Error saving model: {e}")
            # Fallback
            if os.path.exists(tmp_path):
                 try:
                     torch.save(self.model.state_dict(), self.model_path)
                     os.remove(tmp_path)
                 except:
                     pass

    def predict(self, state_vector):
        """
        Predict value for a single state vector.
        """
        with torch.no_grad():
            tensor = torch.FloatTensor(state_vector).unsqueeze(0).to(self.device)
            value = self.model(tensor)
            return value.item()

    def train(self, states, targets, epochs=1):
        """
        Train the model on a batch of data.
        states: List of feature vectors
        targets: List of values (-1 or 1)
        """
        self.model.train()
        
        state_tensor = torch.FloatTensor(states).to(self.device)
        target_tensor = torch.FloatTensor(targets).unsqueeze(1).to(self.device)
        
        for _ in range(epochs):
            self.optimizer.zero_grad()
            outputs = self.model(state_tensor)
            loss = F.mse_loss(outputs, target_tensor)
            loss.backward()
            self.optimizer.step()
            
        self.model.eval()
        return loss.item()
