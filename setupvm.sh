#! /bin/bash

function install_packages {
    apt-get -y install git daemontools mysql-client mysql-server g++ make emacs screen
    pushd ~/
    wget "http://nodejs.org/dist/v0.8.18/node-v0.8.18.tar.gz"
    tar -zvxf node-v0.8.18.tar.gz
    cd node-v0.8.18
    ./configure --prefix=/opt/node
    make
    make install
    if [[ `grep "/opt/node/bin" ~/.bashrc` == "" ]]
    then
        echo "export PATH=/opt/node/bin:\$PATH" >> ~/.bashrc
        . ~/.bashrc
    fi
    cd ~/
    git clone "git@github.com:dhruvbird/wikipins.org.git"
    cd wikipins.org
    npm install .

    mkdir -p /var/log/wikipins
    mkdir -p /etc/service/wikipins

    cp ~/wikipins.org/daemontools-run /etc/service/wikipins/run
    chmod +x /etc/service/wikipins/run

    echo "PLEASE REMEBER TO CONFIGURE MYSQL's /etc/mysql/my.cnf AND RESTART MYSQLD"
    echo "ALSO, REMEBER TO RUN: GRANT ALL ON *.* TO 'root'@'HOST' IDENTIFIED BY 'PASSWORD'"
}

function setup_swap {
    if [[ `swapon -s | wc -l` != 1 ]]
    then
        # We already have swap enabled
        return
    fi
    dd if=/dev/zero of=/swapfile bs=1024 count=1024k
    mkswap /swapfile
    swapon /swapfile
    echo "/swapfile       none    swap    sw      0       0" >> /etc/fstab
    chown root:root /swapfile 
    chmod 0600 /swapfile
}

setup_swap
install_packages
