import { Component, OnInit } from '@angular/core';

import { NavParams, AlertController, ModalController } from '@ionic/angular'


// Importación necesaria para poder realizar llamadas telefónicas
import { CallNumber } from '@ionic-native/call-number/ngx'

import { ActionSheetController } from '@ionic/angular'
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

import * as mapboxgl from 'mapbox-gl/dist/mapbox-gl.js'

import { LoadingController } from '@ionic/angular'
import { resolve } from 'q';
import { Geolocation } from '@ionic-native/geolocation/ngx'
import { RESTService } from '../rest.service';

@Component({
  selector: 'app-service-details',
  templateUrl: './service-details.page.html',
  styleUrls: ['./service-details.page.scss'],
})
export class ServiceDetailsPage implements OnInit {

  currentModal: ModalController
  currentSegment: string = "map"
  phoneNumbers: string[] = []
  commentFormGroup: FormGroup
  currentCMA: any = null
  starsCmaRate: any = []
  services = []
  horarios = []

  userLat: any = ''
  userLng: any = ''

  constructor(
    private nav: NavParams,
    private llamada: CallNumber,
    private actionSheetController: ActionSheetController,
    private formBuilder: FormBuilder,
    private loading: LoadingController,
    private alert: AlertController,
    private gps: Geolocation,
    private api: RESTService,
  ) {
    mapboxgl.accessToken = 'pk.eyJ1IjoiaWRzZmVybmFuZG8iLCJhIjoiY2p4NHhzZjQ3MDJyNzQzdXJxYW01cGE4NSJ9.703KpAMi7SCviDt79F_Y1g'
    this.currentModal = this.nav.get('modal')
    this.phoneNumbers = []

    this.commentFormGroup = this.formBuilder.group({
      'rate': ['', Validators.required],
      'comment': ['', Validators.required],
      'title': ['', Validators.required]
    })
  }


  async showMap() {
    //Obtener la ubicación del cliente
    await this.gps.getCurrentPosition().then(
      (pos) => {
        this.userLng = pos.coords.longitude
        this.userLat = pos.coords.latitude
      },
      (error) => {
        this.showAlert('No pudimos acceder a tu ubicación, verifica lo siguiente:\n1. ¿Está encendido el GPS de tu dispositivo?\n2. ¿Nos otorgaste acceso a usar tu GPS?')
      }
    )

    var map = new mapboxgl.Map({
      container: 'taller-map',
      style: 'mapbox://styles/mapbox/streets-v11',
      zoom: 15,
      center: [
        parseFloat(this.userLng),
        parseFloat(this.userLat)
      ]
    });
    var marker = new mapboxgl.Marker()
    marker.setLngLat([
      parseFloat(this.currentCMA.longitude),
      parseFloat(this.currentCMA.latitude)
    ])
    marker.setPopup(new mapboxgl.Popup({
      offset: 25
    }) // add popups
      .setHTML('<h3>' + this.currentCMA.name + '</h3><p>' + this.currentCMA.address + '</p>'))
    marker.addTo(map)


    var marker_user = new mapboxgl.Marker()
    marker_user.setLngLat([
      parseFloat(this.userLng),
      parseFloat(this.userLat)
    ])
    marker_user.setPopup(new mapboxgl.Popup({
      offset: 25
    }) // add popups
      .setHTML('<h3>' + 'Aquí estás' + '</h3>'))
    marker_user.addTo(map)
  }
  ionViewDidLoad() {
  }
  async ionViewDidEnter() {
    try {
      await this.load()
      this.showMap()
    }
    catch (er) {
      this.showAlert(er)
    }
    return Promise.resolve(this.currentCMA)
  }

  //Obtener los datos desde la API
  async load() {
    const loading = await this.loading.create({
      message: 'Cargando datos del taller...',
      translucent: true,
      backdropDismiss: false,
      showBackdrop: true
    });
    await loading.present()
    try {
      this.currentCMA = await this.nav.get('cma')
      this.currentCMA.cmv_phones.forEach(numero => {
        this.phoneNumbers.push(numero.number)
      });
      //Servicios del CMA
      this.currentCMA.cmv_services.forEach(serv => {
        this.services.push(serv.description)
      });
      //Horarios del CMA
      this.currentCMA.cmv_schedules.forEach(horario => {
        this.horarios.push(horario)
      });
      
      const gradeAverage = this.currentCMA.grade_average.split('.')
      let enteros = gradeAverage[0]
      let decimalesStr = '0.' + gradeAverage[0]
      let decimales = 0
      const estrellasGrises = ( 5 - parseInt(enteros) ) - 1

      if(decimalesStr == '0.0')
      {
        decimales = 0
      }
      else if(parseFloat(decimalesStr) < 0.5)
      {
        decimales = 0.5
      }
      else{
        decimales = 1
      }


      if(parseInt(enteros) == 0)
      {
        enteros = null
      }
      else
      {
        let tmp = []
        for (let index = 0; index < parseInt(enteros); index++) {
          tmp.push(index)
        }
        enteros = tmp
      }

      let _tmp = []//Estrellas restantes
      for (let index = 0; index < estrellasGrises; index++) {
        _tmp.push(index)
      }

      this.starsCmaRate = [
        enteros,
        decimales,
        _tmp
      ]

      loading.dismiss()
    }
    catch (e) {
      loading.dismiss()
      this.showAlert('Ocurrió un error mientras se obtenían los datos')
    }
    // loading.dismiss()
  }

  ngOnInit() {
  }

  /**
  * Llamar al CMA
  *
  * @param   {number}  number  Número telefónico del CMA
  *
  */
  async call() {
    if (this.phoneNumbers.length > 1) {
      let _buttons = []

      this.phoneNumbers.forEach(number => {
        _buttons.push(
          {
            text: number,
            handler: () => {
              this.tryCall(number)
            }
          }
        )
      })
      _buttons.push({
        text: 'Cancelar',
        role: 'cancel',
        handler: () => {
          console.log('Cancel clicked');
        }
      })
      const actionSheet = await this.actionSheetController.create({
        header: 'Elige una opción',
        translucent: true,
        buttons: _buttons
      })
      await actionSheet.present();
    }
    else if(this.phoneNumbers.length == 1)
    {
      this.tryCall(this.phoneNumbers[0])
    }
    else {
      this.showAlert(`${this.currentCMA.name} no tiene números registrados`)
    }

  }

  tryCall(number) {
    const numero = '' + number
    this.llamada.callNumber(numero, true)
      .then(res => {
        // En este punto la GUI de la llamada se encuentra en curso
      })
      .catch(err => {
        alert(`La llamada no se pudo realizar,\n ${err}`)
      })
  }
  /**
  * Salir de la vista actual
  *
  */
  leave() {
    this.currentModal.dismiss()
  }


  async eval() {
    const loading = await this.loading.create({
      message: 'Enviando tu comentario...',
      translucent: true,
      backdropDismiss: false,
      showBackdrop: true
    });
    await loading.present()
    this.api.enviarComentario({
      token: localStorage.getItem('auth_token'),
      id: this.currentCMA.id,
      title: this.commentFormGroup.get('title').value,
      content: this.commentFormGroup.get('comment').value,
      stars: this.commentFormGroup.get('rate').value,
    }).subscribe(
      (response) => {
        loading.dismiss()
        this.currentCMA.cmv_reviews.unshift({
          title: response.review.title,
          content: response.review.content,
          date: response.review.date,
          stars: response.review.stars
        })
        this.commentFormGroup.reset()
        this.showAlert(`Hemos enviado tu comentario, con tu apoyo lograrás que ${this.currentCMA.name} llegue más lejos!`)
        //currentCMA.cmv_reviews
      },
      (error) => {
        loading.dismiss()
        this.showAlert(`
          Algo salió mal:

          <ol>
            <li> Verifica tu conexión a internet </li>
            <li> Nuestros servidores están en mantenimiento, lamentamos las molestias </li>
          </ol>
        `)
      }
    )
  }


  /**
* Mostrar una alerta, ya sea de error o de success
*
* @param   {String}  text  Texto a mostrar
*
* @return  {Alert}     Alerta
*/
  async showAlert(text: any) {
    let alert = await this.alert.create({
      header: "Mechanicapp",
      message: text,
      buttons: ['Ok'],
      translucent: true
    });
    return await alert.present();
  }

  /**
   * Mostrar las propiedades de un objeto
   * @param  obj Objeto
   * @return String [Estructura del objeto]
   */
  objToString(obj) {
    var str = '';
    for (var p in obj) {
      if (obj.hasOwnProperty(p)) {
        str += p + '::' + obj[p] + '\n';
      }
    }
    return str;
  }
}
