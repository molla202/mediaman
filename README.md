# Media Node
OmniFlix Media Node is software for asset management, live streaming, and simulcasting on the OmniFlix Network. Upload, manage, and broadcast multimedia content seamlessly, while also having the capability to register and lease your node for monetization.

### System  Requirements (Minimum)
- OS: Linux / Ubuntu (22.04 LTS or 24.04 LTS)
- CPU: 4 Core
- RAM: 16GB
- Storage: 100GB SSD

Required open ports
- 1935 (default RTMP port for streaming)
- 80 & 443 (For API domain)


---

### Installation Instructions
#### 1. Setup MediaNode
1. Clone the repository:
```bash
git clone https://gitlab.layerzerox.com/omniflix/media-node.git
```

2. Navigate to the project directory:
```bash
cd media-node
```

3. Make a copy of .env.example to .env
```bash
cp .env.example .env
```

4. Update your changes in .env
```bash
nano .env
```
- Add your OmniFlix address as `ADMIN_ADDRESS`
- Modify `MEDIA_SPACE_FOR_LEASE` value if you do not want to give lease and use it for yourself.
- Modify the `DEFAULT_CHAIN` in which OmniFlix chain you will register or use the Media Node.

5. Run Media Node Setup:
```bash
./media-node.sh setup
```

#### 2. Start Media Node
Note: Only start After setup
```bash
./media-node.sh start
```
Check logs

```bash
docker logs media_node -f
```

Note: This will take more time for the first time to build local image and start the medianode

By default Medianode will start on 8081, and proxy passed in nginx to work with your domain
you can query status of the media-node locally using
```bash
curl http://localhost:8081/api/status
```

Details of media node installation

```bash
docker exec -it media_node sh -c "cat /home/ubuntu/.config/config.json"
```
Note: You can find your medianode id details here

#### 3. Register Media Node (Optional)
Execute below script from media-node folder
```bash
./media-node.sh register
```
---


#### Some Docker commands incase any issues you face.

View logs

```bash
docker logs media_node -f
```
Stop and delete all docker containers
```bash
 docker rm -f $(docker ps -a -q) 
``` 
Remove images
```bash
docker image rmi $(docker image ls -aq)
```
Remove volumes
```bash
docker volume prune -a
```

---
