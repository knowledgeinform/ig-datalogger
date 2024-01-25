# ig-datalogger

Registration page for guest network (Feb. 2, 2023)
ns9200-nas-1.jhuapl.edu/registration/

Log temperature and mass scale data

Installing node on rpi (use nvm)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
nvm install node
node -v
npm -v
which node # gets the /path/to/node
sudo su
cd /usr/sbin
ln -s /path/to/node node
```

Installing influxdb on rpi
```bash
curl https://repos.influxdata.com/influxdb.key | gpg --dearmor | sudo tee /usr/share/keyrings/influxdb-archive-keyring.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/influxdb-archive-keyring.gpg] https://repos.influxdata.com/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/influxdb.list
sudo apt install influxdb

sudo systemctl unmask influxdb.service
sudo systemctl enable influxdb.service
sudo systemctl start influxdb
```

Installing the repo
```bash
npm install
```

Rebuilding the sources
```bash
npm rebuild
```

For newer versions of yarn
```bash
yarn rebuild
```

Running in test mode
```bash
cd src
node ../bin/run server -t
```

Running in production mode on port 80
```bash
cd src
node ../bin/run server 80
```
