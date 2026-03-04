import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateServerDto,
  UpdateServerDto,
  ConnectServerDto,
  RegisterAgentDto,
} from './dto/server.dto';
import { Client } from 'ssh2';

@Injectable()
export class ServersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateServerDto) {
    const server = await this.prisma.server.create({
      data: {
        ...dto,
        userId,
        status: 'online', // Mocking deployment as immediate for now
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`, // Mock IP
      },
    });

    await this.prisma.activity.create({
      data: {
        type: 'server_create',
        message: `Created server ${server.name}`,
        userId,
        serverId: server.id,
      },
    });

    return server;
  }

  async findAll(userId: string) {
    return this.prisma.server.findMany({
      where: { userId },
      include: { deployments: true },
    });
  }

  async findOne(userId: string, id: string) {
    const server = await this.prisma.server.findUnique({
      where: { id },
    });

    if (!server || server.userId !== userId) {
      throw new NotFoundException('Server not found');
    }

    return server;
  }

  async update(userId: string, id: string, dto: UpdateServerDto) {
    await this.findOne(userId, id);
    return this.prisma.server.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.server.delete({
      where: { id },
    });
  }

  async performAction(userId: string, id: string, action: string) {
    const server = await this.findOne(userId, id);

    // Logic for interacting with VPS provider would go here

    await this.prisma.activity.create({
      data: {
        type: `server_${action}`,
        message: `${action.toUpperCase()} requested for ${server.name}`,
        userId,
        serverId: server.id,
      },
    });

    return { message: `Action ${action} initiated successfully` };
  }

  async connect(userId: string, dto: ConnectServerDto) {
    const trimmedIp = dto.ip.trim();
    const existingServer = await this.prisma.server.findFirst({
      where: { ip: trimmedIp, userId },
    });

    if (existingServer) {
      throw new ConflictException(
        `Server with IP ${trimmedIp} is already registered.`,
      );
    }

    const server = await this.prisma.server.create({
      data: {
        name: dto.name,
        ip: dto.ip,
        os: dto.os,
        region: dto.region,
        sshUser: dto.sshUser,
        sshPassword: dto.sshPassword,
        sshKey: dto.sshKey,
        sshPort: dto.sshPort || 22,
        userId,
        status: 'offline',
        connectionStatus: 'PENDING',
      },
    });

    // Start async bootstrapping
    this.bootstrapServer(server.id, dto).catch(console.error);

    return server;
  }

  async registerAgent(dto: RegisterAgentDto) {
    const server = await this.prisma.server.findUnique({
      where: { id: dto.serverId },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    // In a real app, we'd verify the token
    return this.prisma.server.update({
      where: { id: dto.serverId },
      data: {
        connectionStatus: 'CONNECTED',
        status: 'online',
        ...(dto.cpu && { cpu: dto.cpu }),
        ...(dto.memory && { memory: Math.round(dto.memory / 1024) }), // convert MB to GB
      },
    });
  }

  private async bootstrapServer(serverId: string, dto: ConnectServerDto) {
    const conn = new Client();

    try {
      await this.prisma.server.update({
        where: { id: serverId },
        data: { connectionStatus: 'CONNECTING' },
      });

      return new Promise((resolve, reject) => {
        conn
          .on('ready', () => {
            conn.exec(this.getBootstrapCommand(serverId), (err, stream) => {
              if (err) reject(err);
              stream
                .on('close', (code) => {
                  if (code !== 0) reject(new Error(`Exit code ${code}`));
                  conn.end();
                  resolve(true);
                })
                .on('data', (data) => {
                  console.log('STDOUT: ' + data);
                })
                .stderr.on('data', (data) =>
                  console.error('STDERR:', data.toString()),
                );
            });
          })
          .on('error', reject);
        const config: any = {
          host: dto.ip.trim(),
          port: dto.sshPort || 22,
          username: dto.sshUser,
        };

        if (dto.sshPassword) {
          config.password = dto.sshPassword;
        }

        if (dto.sshKey) {
          config.privateKey = dto.sshKey;
        }

        conn.connect(config);
      });
    } catch (error) {
      console.error('Bootstrap failed:', error);
      await this.prisma.server.update({
        where: { id: serverId },
        data: { connectionStatus: 'FAILED' },
      });
    }
  }

  private getBootstrapCommand(serverId: string) {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';

    return `#!/bin/bash
set -e

echo "============================================="
echo "        VPSHub Agent Bootstrap Script        "
echo "============================================="
echo ""

# 1. System Update
echo "[1/4] Updating system packages..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update -y -qq >/dev/null 2>&1
elif command -v yum &> /dev/null; then
    sudo yum update -y -q >/dev/null 2>&1
fi

# 2. Check for Docker
echo "[2/4] Checking for Docker dependency..."
if ! command -v docker &> /dev/null; then
    echo "      Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh >/dev/null 2>&1
    rm get-docker.sh
else
    echo "      Docker is already installed."
fi

# 3. Pull agent image
echo "[3/4] Pulling VPSHub Agent..."
# Simulated pulling of the agent container
sleep 2

# 4. Gather system stats and register agent
echo "[4/4] Registering agent with VPSHub..."

# Gather CPU and Memory
CPU_CORES=$(nproc 2>/dev/null || echo 1)
MEMORY_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo 1024)

# Create dynamic payload
PAYLOAD=$(cat <<EOF
{
  "serverId": "${serverId}",
  "token": "agent-token",
  "cpu": \${CPU_CORES},
  "memory": \${MEMORY_MB}
}
EOF
)

RESPONSE=$(curl -s -X POST ${apiUrl}/servers/register-agent \\
  -H "Content-Type: application/json" \\
  -w "%{http_code}" \\
  -d "\$PAYLOAD")

HTTP_CODE=$(echo "\$RESPONSE" | tr -d '\n' | sed -e 's/.*\\([0-9]\\{3\\}\\)$/\\1/')

if [ "\$HTTP_CODE" -eq 200 ] || [ "\$HTTP_CODE" -eq 201 ]; then
    echo ""
    echo "============================================="
    echo "  Bootstrap completed successfully! ✓"
    echo "  Your VPS is now connected to VPSHub."
    echo "  Detected CPU: \${CPU_CORES} cores, Mem: \${MEMORY_MB} MB"
    echo "============================================="
else
    echo "Failed to register agent. HTTP Status: \$HTTP_CODE"
    exit 1
fi
`;
  }

  async getServerStats(userId: string, serverId: string) {
    const server = await this.findOne(userId, serverId);

    if (server.connectionStatus !== 'CONNECTED') {
      throw new BadRequestException('Server is not connected yet');
    }

    // Shell script to collect raw stats and echo as JSON
    const statsScript = `
#!/bin/bash

# CPU Usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}' || echo 0)

# Memory
MEM_TOTAL=$(free -m | awk '/Mem:/{print $2}' || echo 0)
MEM_USED=$(free -m | awk '/Mem:/{print $3}' || echo 0)
if [ "$MEM_TOTAL" -gt 0 ]; then
  # Use awk with literal format string
  MEM_PERCENT=$(awk "BEGIN {printf \\"%.2f\\", ($MEM_USED / $MEM_TOTAL) * 100}" 2>/dev/null || echo 0)
else
  MEM_PERCENT=0
fi

# Disk Usage
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//' || echo 0)

# Services (simplified heuristic for common services)
SERVICES_JSON=$(systemctl is-active nginx postgresql redis docker ssh 2>/dev/null | awk '
BEGIN { printf "[" }
{
  svc=""
  if (NR==1) svc="nginx"
  else if (NR==2) svc="postgresql"
  else if (NR==3) svc="redis"
  else if (NR==4) svc="docker"
  else if (NR==5) svc="ssh"
  
  if(NR>1) printf ","
  printf "{\\"name\\": \\"%s\\", \\"status\\": \\"%s\\", \\"port\\": null}", svc, $1
}
END { printf "]" }' || echo "[]")

# Ports (ss -tulnp output parsed to extract service names)
PORTS_JSON=$(ss -tulnp 2>/dev/null | awk 'NR>1 {
  # Get local port
  split($5, a, ":"); 
  port=a[length(a)]; 
  
  # Get service name from users field: users:(("name",pid=123,fd=456))
  svc="unknown"
  for (i=1; i<=NF; i++) {
    if ($i ~ /users:/) {
      if (match($i, /"[^"]+"/)) {
        svc = substr($i, RSTART + 1, RLENGTH - 2)
      }
      break
    }
  }
  
  if(port ~ /^[0-9]+$/ && !seen[port]++) {
    ports[port]=svc
  }
} END {
  printf "["
  c=0
  for(p in ports) {
    if(c>0) printf ","
    printf "{\\"port\\": %s, \\"service\\": \\"%s\\", \\"type\\": \\"TCP\\"}", p, ports[p]
    c++
  }
  printf "]"
}' || echo "[]")

# Ensure values are never empty for JSON
CPU_VAL=\${CPU_USAGE:-0}
MEM_VAL=\${MEM_PERCENT:-0}
DISK_VAL=\${DISK_USAGE:-0}

cat <<EOF
{
  "cpu": \$CPU_VAL,
  "memory": \$MEM_VAL,
  "disk": \$DISK_VAL,
  "services": \$SERVICES_JSON,
  "ports": \$PORTS_JSON
}
EOF
`;

    const output = await this.executeSshCommand(server, statsScript);
    try {
      // Find the start of the JSON object to ignore debug/stderr junk
      const jsonStart = output.indexOf('{');
      const jsonEnd = output.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1)
        throw new Error('No JSON object found in output');
      const cleanOutput = output.substring(jsonStart, jsonEnd + 1).trim();

      const parsed = JSON.parse(cleanOutput);
      // Map common ports locally
      const portMap: Record<string, string> = {
        '22': 'SSH',
        '80': 'HTTP (Nginx)',
        '443': 'HTTPS (Nginx)',
        '5432': 'PostgreSQL',
        '6379': 'Redis',
        '3000': 'API Hub',
      };
      if (parsed.ports && Array.isArray(parsed.ports)) {
        parsed.ports.forEach((p: any) => {
          const portStr = String(p.port);
          // If awk found a name and it is not "unknown", we use it, otherwise use our map
          if (p.service === 'unknown' || !p.service) {
            p.service = portMap[portStr] || 'Unknown Service';
          } else {
            // "Prettify" some common names
            if (p.service === 'sshd') p.service = 'SSH';
            if (p.service === 'nginx') p.service = 'Nginx';
            if (p.service === 'postgres') p.service = 'PostgreSQL';
            if (p.service === 'redis-server') p.service = 'Redis';
          }
        });
      }

      // Map ports to services
      if (parsed.services && Array.isArray(parsed.services)) {
        parsed.services.forEach((s: any) => {
          if (s.name === 'nginx') s.port = 80;
          if (s.name === 'postgresql') s.port = 5432;
          if (s.name === 'redis') s.port = 6379;
          if (s.name === 'ssh') s.port = 22;
        });
      }

      return parsed;
    } catch (e) {
      console.error('Failed to parse stats:', output);
      throw new BadRequestException(
        `Failed to retrieve server stats. Raw output: ${output}`,
      );
    }
  }

  async executeTerminalCommand(
    userId: string,
    serverId: string,
    command: string,
  ) {
    const server = await this.findOne(userId, serverId);

    if (server.connectionStatus !== 'CONNECTED') {
      throw new BadRequestException('Server is not connected yet');
    }

    try {
      const output = await this.executeSshCommand(server, command);
      return { output };
    } catch (error) {
      return { output: 'Error executing command: ' + error.message };
    }
  }

  async getDockerContainers(userId: string, serverId: string) {
    const server = await this.findOne(userId, serverId);

    if (server.connectionStatus !== 'CONNECTED') {
      throw new BadRequestException('Server is not connected yet');
    }

    const command = "docker ps -a --format '{{json .}}'";
    try {
      const output = await this.executeSshCommand(server, command);
      if (!output.trim()) return [];

      // Parse line by line
      const containers = output
        .trim()
        .split('\n')
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (e) {
            console.error('Failed to parse container line:', line);
            return null;
          }
        })
        .filter((c) => c !== null);

      return containers;
    } catch (error) {
      console.error('Failed to get docker containers:', error);
      throw new BadRequestException(
        'Failed to retrieve Docker containers. Is Docker installed?',
      );
    }
  }

  async handleDockerAction(
    userId: string,
    serverId: string,
    containerId: string,
    action: string,
  ) {
    const server = await this.findOne(userId, serverId);

    if (server.connectionStatus !== 'CONNECTED') {
      throw new BadRequestException('Server is not connected yet');
    }

    const validActions = ['start', 'stop', 'restart', 'rm'];
    if (!validActions.includes(action)) {
      throw new BadRequestException('Invalid Docker action');
    }

    const command = `docker ${action} ${containerId}`;
    try {
      const output = await this.executeSshCommand(server, command);

      await this.prisma.activity.create({
        data: {
          type: `docker_${action}`,
          message: `Docker ${action} requested for container ${containerId} on ${server.name}`,
          userId,
          serverId: server.id,
        },
      });

      return { output };
    } catch (error) {
      throw new BadRequestException(
        `Failed to ${action} container: ${error.message}`,
      );
    }
  }

  public async uploadFileContent(
    server: any,
    remotePath: string,
    content: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn
        .on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end();
              return reject(err);
            }
            const stream = sftp.createWriteStream(remotePath);
            stream.on('close', () => {
              conn.end();
              resolve();
            });
            stream.on('error', (err) => {
              conn.end();
              reject(err);
            });
            stream.write(content);
            stream.end();
          });
        })
        .on('error', (err) => {
          reject(err);
        });
      const config: any = {
        host: server.ip.trim(),
        port: server.sshPort || 22,
        username: server.sshUser,
        readyTimeout: 20000,
      };

      if (server.sshPassword) config.password = server.sshPassword;
      if (server.sshKey) config.privateKey = server.sshKey;

      conn.connect(config);
    });
  }

  public executeSshCommand(
    server: any,
    command: string,
    onData?: (chunk: string) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let output = '';

      conn
        .on('ready', () => {
          conn.exec(command, (err, stream) => {
            if (err) {
              conn.end();
              return reject(err);
            }

            stream.on('data', (data) => {
              const chunk = data.toString();
              output += chunk;

              if (onData) onData(chunk);
            });

            stream.stderr.on('data', (data) => {
              const chunk = data.toString();
              output += chunk;

              if (onData) onData(chunk);
            });

            stream.on('close', (code) => {
              conn.end();
              if (code !== 0) {
                const error = new Error(
                  `Command failed with exit code ${code}`,
                );
                (error as any).output = output;
                return reject(error);
              }
              resolve(output);
            });
          });
        })
        .on('error', (err) => {
          reject(err);
        });

      const config: any = {
        host: server.ip.trim(),
        port: server.sshPort || 22,
        username: server.sshUser,
        readyTimeout: 20000,
      };

      if (server.sshPassword) config.password = server.sshPassword;
      if (server.sshKey) config.privateKey = server.sshKey;

      conn.connect(config);
    });
  }

  public async executeSshScript(
    server: any,
    scriptContent: string,
    onData?: (chunk: string) => void,
  ): Promise<string> {
    const timestamp = Date.now();
    const remotePath = `/tmp/vpshub-deploy-${timestamp}.sh`;

    try {
      if (onData) onData(`Uploading deployment script to ${remotePath}...\n`);
      await this.uploadFileContent(server, remotePath, scriptContent);

      if (onData) onData(`Setting execution permissions...\n`);
      await this.executeSshCommand(server, `chmod +x ${remotePath}`);

      if (onData) onData(`Executing script...\n`);
      const output = await this.executeSshCommand(server, remotePath, onData);

      // Cleanup
      await this.executeSshCommand(server, `rm -f ${remotePath}`);

      return output;
    } catch (error) {
      // Attempt cleanup even on failure
      try {
        await this.executeSshCommand(server, `rm -f ${remotePath}`);
      } catch (e) {
        // ignore cleanup error
      }
      throw error;
    }
  }

  async getPm2Processes(userId: string, serverId: string) {
    const server = await this.findOne(userId, serverId);

    if (server.connectionStatus !== 'CONNECTED') {
      throw new BadRequestException('Server is not connected yet');
    }

    const command = 'pm2 jlist';
    try {
      const output = await this.executeSshCommand(server, command);
      if (!output.trim()) return [];

      try {
        return JSON.parse(output);
      } catch (e) {
        // PM2 might not be installed or output might be malformed
        console.error('Failed to parse PM2 output:', output);
        return [];
      }
    } catch (error) {
      console.error('Failed to get PM2 processes:', error);
      return [];
    }
  }

  async handlePm2Action(
    userId: string,
    serverId: string,
    nameOrId: string,
    action: string,
  ) {
    const server = await this.findOne(userId, serverId);

    if (server.connectionStatus !== 'CONNECTED') {
      throw new BadRequestException('Server is not connected yet');
    }

    const validActions = ['start', 'stop', 'restart', 'delete'];
    if (!validActions.includes(action)) {
      throw new BadRequestException('Invalid PM2 action');
    }

    const command = `pm2 ${action} ${nameOrId}`;
    try {
      const output = await this.executeSshCommand(server, command);

      await this.prisma.activity.create({
        data: {
          type: `pm2_${action}`,
          message: `PM2 ${action} requested for process ${nameOrId} on ${server.name}`,
          userId,
          serverId: server.id,
        },
      });

      return { output };
    } catch (error) {
      throw new BadRequestException(
        `Failed to ${action} PM2 process: ${error.message}`,
      );
    }
  }
}
